#!/usr/bin/env python
# -*- coding: utf-8 -*-


try:
    from setuptools import setup
except ImportError:
    from distutils.core import setup

with open('README.md') as readme_file:
    readme = readme_file.read()

requirements = [
    # TODO: put package requirements here
]

test_requirements = [
    # TODO: put package test requirements here
]

setup(
    name = 'CephEWS',
    version = '0.1.0',
    description = 'Ceph Early Warning System',
    long_description = readme,
    author = 'Cisco Systems, Inc.',
    author_email = 'kazhang2@cisco.com',
    url='https://github.com/CiscoSystems/CephEWS',
    packages = [
        'CephEWS',
    ],
    package_dir = {'CephEWS':
                   'dashboard/webapp'},
    include_package_data=True,
    install_requires=requirements,
    license="Apache License 2.0",
    zip_safe=False,
    keywords='cephews',
    classifiers=[
        'Development Status :: 2 - Pre-Alpha',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: Apache License 2.0',
        'Natural Language :: English',
        "Programming Language :: Python :: 2",
        'Programming Language :: Python :: 2.6',
        'Programming Language :: Python :: 2.7',
    ],
    test_suite='tests',
    tests_require=test_requirements
)
