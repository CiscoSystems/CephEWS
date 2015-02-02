from django.conf.urls import patterns, include, url
from webapp.views import login, logout, overview, osd_status, pool, crush_rule
from webapp.views import distribution, json_response

from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns(
    '',
    # Examples:
    # url(r'^$', 'dashboard.views.home', name='home'),
    # url(r'^blog/', include('blog.urls')),

    url(r'^admin/', include(admin.site.urls)),
    url(r'^$', overview, name='index'),
    url(r'^login$', login, name='login'),
    url(r'^logout$', logout, name='logout'),
    url(r'^overview$', overview, name='overview'),
    url(r'^osd_status$', osd_status, name='osd_status'),
    url(r'^pool$', pool, name='pool'),
    url(r'^crush_rule$', crush_rule, name='crush_rule'),
    url(r'^distribution$', distribution, name='distribution'),
    url(r'^json$', json_response, name='json'),
)
