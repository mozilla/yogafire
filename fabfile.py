import os

import fabdeploytools.envs
from fabric.api import env, lcd, local, task
from fabdeploytools import helpers

import deploysettings as settings

env.key_filename = settings.SSH_KEY
fabdeploytools.envs.loadenv(settings.CLUSTER)

ROOT, YOGAFIRE = helpers.get_app_dirs(__file__)

ZAMBONI = '%s/zamboni' % settings.ZAMBONI_DIR
ZAMBONI_PYTHON = '%s/venv/bin/python' % settings.ZAMBONI_DIR

COMMONPLACE = '%s/node_modules/commonplace/bin' % YOGAFIRE
GRUNT = '%s/node_modules/grunt-cli/bin' % YOGAFIRE

YOGAFIRE_PACKAGE = '%s/package/archives/latest_%s.zip' % (YOGAFIRE,
                                                          settings.ENV)

os.environ["PATH"] += os.pathsep + os.pathsep.join([COMMONPLACE, GRUNT])


@task
def pre_update(ref):
    with lcd(YOGAFIRE):
        local('git fetch')
        local('git fetch -t')
        local('git reset --hard %s' % ref)


@task
def update():
    with lcd(YOGAFIRE):
        local('npm install')
        local('npm install --force commonplace@0.3.6')


@task
def deploy():
    build_package()
    upload_package()


@task
def build_package():
    with lcd(YOGAFIRE):
        local('make package_%s' % settings.ENV)


@task
def upload_package():
    with lcd(ZAMBONI):
        local('%s manage.py --settings=settings_local_mkt '
              'upload_new_marketplace_package %s %s'
              % (ZAMBONI_PYTHON, 'marketplace-package', YOGAFIRE_PACKAGE))
