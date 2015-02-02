import json

from django.shortcuts import render
from django.http import HttpResponse
from django.http import HttpResponseRedirect
from django.http import HttpResponseBadRequest
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.utils.datastructures import MultiValueDictKeyError

from api import CephClient
from api import GraphiteClient


@login_required
def index(request):
    template_name = 'index.html'
    return render(request, template_name)


def login(request):
    template_name = 'login.html'
    success_page = "overview"
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']
        user = authenticate(username=username, password=password)
        if user is not None:
            if user.is_active:
                    auth_login(request, user)
                    return HttpResponseRedirect(success_page)
            else:
                    return render(request, template_name,
                                  {'msg': 'User is disabled'})
        else:
            return render(request, template_name, {'msg': 'Wrong Credentials'})
    if request.user.is_authenticated():
        return HttpResponseRedirect(success_page)
    else:
        return render(request, template_name, {'msg': 'Please log in'})


def logout(request):
    success_page = 'login'
    auth_logout(request)
    return HttpResponseRedirect(success_page)


@login_required
def overview(request):
    template_name = 'overview/_overview.html'
    client = CephClient()
    context = dict()
    context['status'] = client.status()
    context['report'] = client.report()
    return render(request, template_name, context)


@login_required
def osd_status(request):
    template_name = 'osd_status/_osd_tree.html'
    context = dict()
    return render(request, template_name, context)


@login_required
def crush_rule(request):
    template_name = "crush_rule/_rule_list.html"
    client = CephClient()
    rules = client.crush_rules()
    return render(request, template_name, {'rules': rules})


@login_required
def pool(request):
    template_name = 'pool/_pool.html'
    client = CephClient()
    context = {'pool_df': client.df()['pools']}
    for pool in context['pool_df']:
        pool['ruleset'] = client.pool_get(pool['name'],
                                          'crush_ruleset')['crush_ruleset']
        pool['size'] = client.pool_get(pool['name'], 'size')['size']
    return render(request, template_name, context)


@login_required
def distribution(request):
    template_name = 'distribution/_distribution.html'
    client = CephClient()
    context = {'pools': client.list_pools()}
    if context['pools']:
        first_pool = context['pools'][0]['poolname'].encode('ascii', 'ignore')
        context['images'] = client.image_list(first_pool)
    else:
        context['images'] = []
    return render(request, template_name, context)


@login_required
def json_response(request):
    try:
        m = request.GET['m']

        if m == 'overview':
            client = GraphiteClient()
            data = client.pool_df(name=request.GET['name'],
                                  stats=(request.GET['stats']).split(','))

        elif m == 'tree':
            client = CephClient()
            context = dict()
            context['data'] = client.osd_tree()
            if len(context['data']):
                data = context['data'][0]

        elif m == 'osd_info':
            client = GraphiteClient()
            data = client.osd_info(hostname=request.GET['host'],
                                   osdid=request.GET['id'])

        elif m == 'osd_io':
            client = GraphiteClient()
            data = client.osd_io()

        elif m == 'query':
            client = CephClient()
            pool = request.GET['pool'].encode('ascii', 'ignore')
            id = request.GET['id'].encode('ascii', 'ignore')
            dist = client.image_dist(pool=pool, id=id)
            data = {'pg': [{'key': 'objects', 'values': []}],
                    'osd': [{'key': 'objects', 'values': []}]}

            for pgid, value in dist['pg'].items():
                data['pg'][0]['values'].append({'x': pgid, 'y': value})
            for osdid, value in dist['osd'].items():
                data['osd'][0]['values'].append({'x': 'osd.'+str(osdid),
                                                 'y': value})

        elif m == 'image_list':
            client = CephClient()
            pool = request.GET['pool'].pool.encode('ascii', 'ignore')
            data = client.image_list(pool=pool)
        elif m == 'create_pool':
            client = CephClient()
            data = client.create_pool(request.GET['name'],
                                      request.GET['pg'],
                                      request.GET['type'],
                                      request.GET['crush_rule'])

        elif m == 'delete_pool':
            client = CephClient()
            data = client.delete_pool(request.GET['pool'])

        elif m == 'create_rule':
            client = CephClient()
            data = client.create_crush_rule(request.GET['name'],
                                            request.GET['root'],
                                            request.GET['type'],
                                            request.GET['mode'])

        elif m == 'delete_rule':
            client = CephClient()
            data = client.delete_crush_rule(request.GET['rule'])
    except MultiValueDictKeyError as e:
        return HttpResponseBadRequest(content=str(e)+" is required")
    return HttpResponse(json.dumps(data), content_type="application/json")
