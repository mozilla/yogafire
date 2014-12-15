# Marketplace Tarako

The Firefox Marketplace frontend for lower-end devices.

## Glossary

<dl>
  <dt><a href="https://github.com/mozilla/ashes">Ashes</a></dt>
  <dd>A secure debug information collection server</dd>

  <dt>Damper</dt>
  <dd>A node.js server that serves a browser-friendly version of Fireplace</dd>

  <dt><a href="https://github.com/mozilla/flue">Flue</a></dt>
  <dd>A mocked-out version of the Marketplace API.</dd>

  <dt>Hearth</dt>
  <dd>The source code for Fireplace.</dd>

  <dt>Smoke Alarm</dt>
  <dd>A functional test runner for great justice.</dd>
</dl>


## Installation

```bash
npm install
npm install -g commonplace
```

### Flue

Comprehensive Flue documentation can be found in
[Flue's README](https://github.com/mozilla/flue/blob/master/README.md).


### Packaged App

Docs can be found on the [Wiki](https://github.com/mozilla/fireplace/wiki/Creating-a-new-Packaged-App-version).

Please note that any file that belongs in the package must get added to `package/files.txt`.


## Usage

If you haven't already, run `commonplace init` to install local settings
files. Some settings (`media/js/settings_local.js`) may need to be updated
if you plan to run a local setup, including `api_url`.

From the terminal, run the following command

```bash
damper
```

This will start a local server and filesystem watcher on 0.0.0.0:8675 by
default.

For more options, read the [damper documentation](https://github.com/mozilla/commonplace/wiki/Damper).

For instructions on running Flue (the mock API server), please see the [Flue
docs](https://github.com/mozilla/fireplace/blob/master/flue/README.rst).


### Compiling

To run the compilation process, which compiles templates, CSS, and locale
files, run the following command:

```bash
commonplace compile
```


### Compiling Includes

If you need to compile include files (i.e.: for Space Heater or a less HTTP-
heavy version of the project), run `commonplace includes`. This will generate
two files:

```
hearth/media/js/include.js
hearth/media/css/include.css
```

The CSS in `include.css` is generated in the order in which CSS files are
included in `hearth/index.html`.

`include.js` uses a lightweight AMD loader (rather than require.js). This keeps
file size down and also makes it possible to name-mangle internal keywords which
otherwise wouldn't be minifiable. Note that the only safe globals are `require`
and `define`---using any other non-browser globals will result in errors. I.e.:
accessing `_` without requiring `'underscore'` will cause the code to fail. Also
note that all modules must include a name as the first parameter.


## Localizing

A detailed guide to extracting strings and creating JS language packs can be
found [on the wiki](https://github.com/mozilla/commonplace/wiki/L10n#extracting-strings).


## The API

[Read the docs.](http://firefox-marketplace-api.readthedocs.org/)


## Tests

Install casper

```bash
brew install casperjs
```

### Running unit tests

Load [http://localhost:8675/tests](http://localhost:8675/tests) in your browser.


### Running functional tests

Before you run the functional tests, make sure your `settings_local.js` file has
the subset of keys found in
[`settings_travis.js`](https://github.com/mozilla/fireplace/blob/master/hearth/media/js/settings_travis.js).

```bash
make test
```

## Local Development With Nginx

See [Using Fireplace with Zamboni](https://github.com/mozilla/fireplace/wiki/Using-Fireplace-with-Zamboni)
