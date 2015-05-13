# CephEWS
Early Warning System for Ceph. Please note this will have code for the ceph dashboard, anomaly detection etc. 

# Dependency

## Collectd

## Graphite

CephEWS reads metrics via Graphite api. Please make sure CephEWS can access Graphite web interface.

## Ceph-rest-api

# Installation
Please install collectd on each of OSD host nodes and one of the monitor nodes.

## Monitor Node Setup
* Enable collectd network plugin, setup collectd server, MaxPacketSize should be larger than 4096.
* Install collectd ceph plugin: https://github.com/rochaporto/collectd-ceph
* Enable collectd write_graphite plugin

## OSD Host Node Setup
* Enable collectd network plugin, send metrics to the collectd server configured above.
* Enable load, memory, disk plugins in collectd.

## Install Django Webapp
* Change settings accordingly.
* Create database: `python manage.py migrate`
* Create super user: `python manage.py createsuperuser`

## Labs feature
* Install librados: sudo apt-get install python-rados
