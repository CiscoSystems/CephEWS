# CephEWS
Early Warning System for Ceph. Please note this will have code for the ceph dashboard, anomaly detection(will be here in the next release) etc. 

## Features
* Ceph cluster monitoring
* Ceph OSD monitoring
* Ceph pool management
* Ceph CRUSH rule management
* Ceph object distribution query

![Screenshots](https://raw.githubusercontent.com/CiscoSystems/CephEWS/screenshots/screenshots/Screenshot%20from%202015-05-14%2010%3A53%3A54.png)

## Dependency

### Ceph-rest-api
CephEWS relys on ceph-rest-api to read Ceph status and manage the whole cluster.

### Collectd
To collect metrics from each OSD hosts.

### Graphite
CephEWS reads metrics via Graphite api. Please make sure CephEWS can access Graphite web interface.

## Installation
Please install collectd on each of OSD host nodes and one of the monitor nodes.

### Monitor Node Setup
* Enable collectd network plugin, setup collectd server, MaxPacketSize should be larger than 4096.
* Install collectd ceph plugin: https://github.com/rochaporto/collectd-ceph.
* Enable collectd write_graphite plugin.

### OSD Host Node Setup
* Enable collectd network plugin, send metrics to the collectd server configured above.
* Enable load, memory, disk plugins in collectd.

### Install Django Webapp
* Copy dashboard/dashboard/settings.py.example to dashboard/dashboard/settings.py. Change settings accordingly.
* Create database: `python manage.py migrate`.
* Create super user: `python manage.py createsuperuser`.
* Start the web server: `python manage.py runserver`, you should be able to see the dashboard in you web browser with the address: `http://127.0.0.1:8000`.

### Labs feature
* Install librados: sudo apt-get install python-rados python-rbd.
* Set the path to `ceph.conf` and `ceph.client.admin.keyring` in dashboard/dashboard/settings.py. Give CephEWS access both of the files.
