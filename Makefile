REPO = "yogafire"
UUID = "f34d3c22-3efe-47ca-803d-6c740da1a851"
VERSION = `date "+%Y.%m.%d_%H.%M.%S"`
VERSION_INT = $(shell date "+%Y%m%d%H%M%S")
TMP = _tmp
SHELL = /bin/bash

# This is what Yulelog's iframe src points to.
DOMAIN?=marketplace.firefox.com

# This is what the app will be named on the device.
NAME?=Marketplace

# This is for `package` (choices: prod, stage, dev).
SERVER?=prod

compile:
	node_modules/.bin/commonplace compile

test: clean compile
	cd smokealarm ; \
	casperjs test tests

# Fireplace (real packaged app)
package: clean
	@rm -rf TMP
	@rm -rf hearth/downloads/icons/*
	@rm -rf hearth/downloads/screenshots/*
	@rm -rf hearth/downloads/thumbnails/*
	@mkdir -p TMP
	@node_modules/.bin/commonplace langpacks
	@cp -r hearth TMP/hearth

	@mv TMP/hearth/media/js/settings_package_$(SERVER).js TMP/hearth/media/js/settings_local_package.js
	@rm -rf TMP/hearth/media/js/{settings_local_hosted.js,settings_package_*.js}

	@pushd TMP && ../node_modules/.bin/commonplace includes && popd
	@pushd TMP && grunt fetchdb && popd

	@cp -r hearth/downloads TMP/hearth/
	@rm -rf TMP/hearth/downloads/screenshots

	@# We have to have a temp file to work around a bug in Mac's version of sed :(
	@sed -i'.bak' -e 's/"Marketplace"/"$(NAME)"/g' TMP/hearth/manifest.webapp
	@sed -i'.bak' -e 's/marketplace\.firefox\.com/$(DOMAIN)/g' TMP/hearth/manifest.webapp
	@sed -i'.bak' -e 's/{launch_path}/app.html/g' TMP/hearth/manifest.webapp
	@sed -i'.bak' -e 's/{fireplace_package_version}/$(VERSION_INT)/g' TMP/hearth/{manifest.webapp,media/js/include.js,app.html}

	@rm -rf package/archives/latest_$(SERVER)
	@mkdir -p package/archives/latest_$(SERVER)
	@rm -f package/archives/latest_$(SERVER).zip

	@pushd TMP/hearth && \
		cat ../../package/files.txt | sed '/^#/ d' | zip -9 -r ../../package/archives/$(NAME)_$(SERVER)_$(VERSION_INT).zip -@ && \
		popd
	@echo "Created package: package/archives/$(NAME)_$(SERVER)_$(VERSION_INT).zip"
	@cp package/archives/$(NAME)_$(SERVER)_$(VERSION_INT).zip package/archives/latest_$(SERVER).zip
	@echo "Created package: package/archives/latest_$(SERVER).zip"

	@pushd package/archives/latest_$(SERVER) && \
		unzip ../latest_$(SERVER).zip && \
		popd
	@echo "Unzipped latest package: package/archives/latest_$(SERVER)/"

	@rm -rf TMP

fat_package: compile
	@rm -rf TMP
	@rm -rf hearth/downloads/icons/*
	@rm -rf hearth/downloads/screenshots/*
	@rm -rf hearth/downloads/thumbnails/*
	@mkdir -p TMP
	@node_modules/.bin/commonplace langpacks
	@cp -r hearth TMP/hearth

	@mv TMP/hearth/media/js/settings_package_$(SERVER).js TMP/hearth/media/js/settings_local_package.js
	@rm -rf TMP/hearth/media/js/{settings_local_hosted.js,settings_package_*.js}

	@pushd TMP && grunt fetchdb && popd

	@cp -r hearth/downloads TMP/hearth/
	@rm -rf TMP/hearth/downloads/screenshots

	@# We have to have a temp file to work around a bug in Mac's version of sed :(
	@sed -i'.bak' -e 's/"Marketplace"/"$(NAME)"/g' TMP/hearth/manifest.webapp
	@sed -i'.bak' -e 's/marketplace\.firefox\.com/$(DOMAIN)/g' TMP/hearth/manifest.webapp
	@sed -i'.bak' -e 's/{launch_path}/index.html/g' TMP/hearth/manifest.webapp
	@sed -i'.bak' -e 's/{fireplace_package_version}/$(VERSION_INT)/g' TMP/hearth/{manifest.webapp,media/js/settings_local_package.js,app.html}

	@rm -rf package/archives/latest_fat_$(SERVER)
	@mkdir -p package/archives/latest_fat_$(SERVER)
	@rm -f package/archives/latest_fat_$(SERVER).zip

	@pushd TMP/hearth && \
		zip -r ../../package/archives/fat_$(NAME)_$(SERVER)_$(VERSION_INT).zip . \
		popd
	@echo "Created package: package/archives/fat_$(NAME)_$(SERVER)_$(VERSION_INT).zip"
	@cp package/archives/fat_$(NAME)_$(SERVER)_$(VERSION_INT).zip package/archives/latest_fat_$(SERVER).zip
	@echo "Created package: package/archives/latest_fat_$(SERVER).zip"

	@pushd package/archives/latest_fat_$(SERVER) && \
		unzip ../latest_fat_$(SERVER).zip && \
		popd
	@echo "Unzipped latest package: package/archives/latest_fat_$(SERVER)/"

	@rm -rf TMP

package_prod:
	make package
package_stage:
	SERVER='stage' NAME='Stage' DOMAIN='marketplace.allizom.org' make package
package_dev:
	SERVER='dev' NAME='Dev' DOMAIN='marketplace-dev.allizom.org' make package

fat_package_prod:
	make fat_package
fat_package_stage:
	SERVER='stage' NAME='Stage' DOMAIN='marketplace.allizom.org' make fat_package
fat_package_dev:
	SERVER='dev' NAME='Dev' DOMAIN='marketplace-dev.allizom.org' make fat_package

serve_package:
	@open 'http://localhost:8676/app.html'
	@pushd package/archives/latest_$(SERVER) && \
		python -m SimpleHTTPServer 8676
serve_package_prod:
	make serve_package
serve_package_stage:
	SERVER='stage' make serve_package
serve_package_dev:
	SERVER='dev' make serve_package

submit_package:
	@open 'https://'$(DOMAIN)'/developers/app/tarako-marketplace/status#upload-new-version'
submit_package_prod:
	make submit_package
submit_package_stage:
	DOMAIN='marketplace.allizom.org' make submit_package
submit_package_dev:
	DOMAIN='marketplace-dev.allizom.org' make submit_package

approve_package:
	@open 'https://'$(DOMAIN)'/reviewers/apps/review/tarako-marketplace#review-actions'
approve_package_prod:
	make approve_package
approve_package_stage:
	DOMAIN='marketplace.allizom.org' make approve_package
approve_package_dev:
	DOMAIN='marketplace-dev.allizom.org' make approve_package

clean:
	node_modules/.bin/commonplace clean

deploy:
	git fetch && git reset --hard origin/master && npm install && make includes
