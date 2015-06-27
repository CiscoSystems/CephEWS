# Copyright 2015 Cisco Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may
# not use this file except in compliance with the License. You may obtain
# a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

import requests
import json

from django.conf import settings

try:
    import rados
    import rbd
    WITH_RADOS = True
except ImportError:
    WITH_RADOS = False


class CephClient():
    def __init__(self):
        if WITH_RADOS:
            try:
                self._ceph_cluster = rados.Rados(
                    conffile=settings.CEPH_CONF,
                    conf={"keyring": settings.CEPH_KEYRING})
                self._ceph_cluster.connect()
            except Exception:
                self._ceph_cluster = None
        self._session = requests.Session()

    def request(self, method, url, params=None):
        try:
            resp = self._session.request(method,
                                         url,
                                         params=params,
                                         headers={'Accept': 'application/json',
                                                  'Content-Type':
                                                  'application/json'})
            if not resp.ok:
                raise Exception('connection error')
            resp_json = json.loads(resp.text)
            if resp_json['status'] != 'OK' and 'report' not in url:
                raise Exception('command error')
            return resp_json['output']
        except Exception:
            return {}

    def send_command(self, method, cmd, params=None):
        ceph_url = settings.API_URL
        if not ceph_url.startswith("http://"):
            ceph_url = "http://" + ceph_url
        url = "%s:%d/api/v0.1/" % (ceph_url, settings.API_PORT)
        url += '/'.join(cmd)
        return self.request(method, url, params)

    def status(self):
        return self.send_command('GET', ['status'])

    def report(self):
        return self.send_command('GET', ['report'])

    def osd_tree(self):
        osds = self.send_command('GET', ['osd', 'tree'])
        if not osds:
            return {}
        nodes = osds['nodes']
        osd_dic = dict()
        is_root = dict()
        for node in nodes:
            osd_dic[node['id']] = node
            node['cid'] = node['id']
            is_root[node['id']] = True
            del node['id']

        for node in nodes:
            if 'children' in node:
                children = list()
                for child in node['children']:
                    children.append(osd_dic[child])
                    del is_root[child]
                node['children'] = children

        osd_tree = {'name': 'ceph', 'cid': -32767, 'type_id': -1, 'children':[]}
        for id in is_root:
            osd_tree['children'].append(osd_dic[id])
        return osd_tree

    def crush_rules(self):
        rules = self.send_command('GET', ['osd', 'crush', 'rule', 'dump'])
        for rule in rules:
            step_item = []
            for step in rule['steps']:
                if step['op'] == 'take':
                    step_item.append("take %s" % step['item_name'])
                elif step['op'] == 'chooseleaf_firstn':
                    step_item.append("chooseleaf_firstn %d %s" %
                                     (step['num'], step['type']))
                elif step['op'] == 'choose_firstn':
                    step_item.append("choose_firstn %d %s" %
                                     (step['num'], step['type']))
                else:
                    step_item.append("emit")
            rule['steps'] = step_item
        return rules

    def create_crush_rule(self, name, root, type, mode):
        result = self.send_command('PUT',
                                   ['osd', 'crush', 'rule', 'create-simple'],
                                   params={'name': name,
                                           'root': root,
                                           'type': type,
                                           'mode': mode})
        return result

    def delete_crush_rule(self, name):
        result = self.send_command('PUT', ['osd', 'crush', 'rule', 'rm'],
                                   params={'name': name})
        return result

    def df(self):
        return self.send_command('GET', ['df'])

    def pool_get(self, pool, var):
        return self.send_command('GET', ['osd', 'pool', 'get'],
                                 params={'var': var, 'pool': pool})

    def create_pool(self, name, pg, type, crush_rule):
        return self.send_command('PUT', ['osd', 'pool', 'create'],
                                 params={'pool': name, 'pg_num': pg,
                                         'pgp_num': pg, 'pool_type': type,
                                         'erasure_code_profile': crush_rule})

    def delete_pool(self, pool):
        return self.send_command(
            'PUT',
            ['osd', 'pool', 'delete'],
            params={'pool': pool,
                    'pool2': pool,
                    'sure': '--yes-i-really-really-mean-it'})

    def pool_df(self, name, stats):
        return self.send_command(
            'GET',
            ['osd', 'pool', 'df'],
            params={'name': name, 'stats': ','.join(stats)})

    def list_pools(self):
        return self.send_command('GET', ['osd', 'lspools'])

    def image_dist(self, pool, id):
        resp = {'pg': {}, 'osd': {}}
        if WITH_RADOS and self._ceph_cluster is not None:
            with self._ceph_cluster.open_ioctx(pool) as ioctx:
                with rbd.Image(ioctx, id) as image:
                    stat = image.stat()
                    prefix = stat['block_name_prefix']
                    num_objs = stat['num_objs']
                    for obj in range(num_objs):
                        cmd = ['{"prefix": "osd map", "object": "%s.%016x", \
                                "pool": "%s", "format": "json"}' %
                               (prefix, obj, pool)]
                        ret, outbuf, outs = self._ceph_cluster.mon_command(
                            cmd, '', 0)
                        dist = json.loads(outbuf)
                        pgid = dist['pgid']
                        p_osd = dist['acting_primary']
                        if pgid in resp['pg']:
                            resp['pg'][pgid] += 1
                        else:
                            resp['pg'][pgid] = 1

                        if p_osd in resp['osd']:
                            resp['osd'][p_osd] += 1
                        else:
                            resp['osd'][p_osd] = 1
        return resp

    def osd_info(self, hostname, osdname):
        return self.send_command('GET', ['osd', 'info'],
                                 params={'id': osdname, 'host': hostname})

    def osd_list(self):
        osd_info = self.send_command('GET', ['osd', 'dump'])
        osd_id = []
        for val in osd_info['osds']:
            osd_id.append(val["osd"])
        return osd_id

    def image_list(self, pool):
        if WITH_RADOS and self._ceph_cluster is not None:
            with self._ceph_cluster.open_ioctx(pool) as ioctx:
                r = rbd.RBD()
                return r.list(ioctx)
        return list()


class GraphiteClient:
    def request(self, url):
        if settings.GRAPHITE_AUTH:
            return requests.get(url, auth=(settings.GRAPHITE_USERNAME,
                                           settings.GRAPHITE_PASSWORD),
                                verify=False)
        else:
            return requests.get(url)

    def get_metrics(self, metrics, begin=None, end=None):
        graphite_ep = settings.GRAPHITE_ENDPOINT
        if not graphite_ep.endswith('/'):
            graphite_ep += '/'

        metrics = ['target='+x for x in metrics]
        url = graphite_ep + "?" + "&".join(metrics)
        if begin is not None:
            url += "&from=" + begin
        if end is not None:
            url += "&end=" + end
        url += "&format=json"

        r = self.request(url)
        if r.status_code == 200:
            return r.json()
        else:
            return []

    def pool_df(self, name, stats):
        metric_prefix = settings.GRAPHITE_PREFIX + settings.GRAPHITE_SERVER +\
            settings.GRAPHITE_SUFIX
        metric_prefix += '.ceph-ceph-pool-' + name

        stat_dict = {"op": "op_per_sec", "rd": "read_bytes_sec",
                     "wr": "write_bytes_sec", "objects": "objects",
                     "used": "bytes_used"}

        metrics = []

        for stat in stats:
            metrics.append(metric_prefix + '.gauge-' + stat_dict[stat])
        results = self.get_metrics(metrics, '-5h')

        for metric in results:
            metric['key'] = metric['target'].split('-')[-1:]
            del metric['target']
            metric['values'] = []
            for val in metric['datapoints']:
                metric['values'].append({'x': val[1], 'y': val[0]})
            del metric['datapoints']

        return results

    def osd_info(self, hostname, osdid):
        metric_prefix = settings.GRAPHITE_PREFIX + hostname + '*' +\
            settings.GRAPHITE_SUFIX

        metrics = ['.load.load.shortterm', '.load.load.midterm',
                   '.load.load.longterm', '.memory.memory-free',
                   '.memory.memory-used']

        metrics = [metric_prefix + x for x in metrics]

        metric_prefix = settings.GRAPHITE_PREFIX + settings.GRAPHITE_SERVER +\
            settings.GRAPHITE_SUFIX

        metrics.append(metric_prefix + '.ceph-ceph-osd-' + osdid +
                       '.gauge-kb_used')
        metrics.append(metric_prefix + '.ceph-ceph-osd-' + osdid +
                       '.gauge-kb_total')

        result = self.get_metrics(metrics, '-60s')

        key_val = {}
        for metric in result:
            name = metric['target'].split('.')[-1]
            key_val[name] = metric['datapoints'][-1][0]

        return {"load": [key_val['shortterm'], key_val['midterm'],
                         key_val['longterm']],
                "disk": {'used': key_val['gauge-kb_used'] * 1024,
                         'free': (key_val['gauge-kb_total'] -
                                  key_val['gauge-kb_used'])*1024},
                "memory": {'used': key_val['memory-used'],
                           'free': key_val['memory-free']}}

    def osd_io(self):
        prefix = '*.ceph-ceph-osd-*'
        metrics = [prefix + x for x in ['.gauge-ops_read', '.gauge-ops_write']]

        result = self.get_metrics(metrics, begin='-120s')

        osds = dict()
        for x in result:
            cluster, osd, io = x['target'].split('.')
            osd = osd.split('-')[-1]
            if x['datapoints'][1][0] is not None:
                value = x['datapoints'][1][0] - x['datapoints'][0][0]
            else:
                value = 0
            if io.endswith('read'):
                if osd in osds:
                    osds[osd]['r'] = value
                else:
                    osds[osd] = {'r': value}
            else:
                if osd in osds:
                    osds[osd]['w'] = value
                else:
                    osds[osd] = {'w': value}

        return [{'id': key, 'r': val['r'], 'w': val['w']}
                for key, val in osds.items()]
