define('helpers_local', ['nunjucks', 'z'], function(nunjucks, z) {
    var filters = nunjucks.require('filters');
    var globals = nunjucks.require('globals');

    z.page.on('click', '.truncated-more', function(e) {
        var $more_link = $(e.target);
        var $latter_description = $more_link.next();
        $latter_description.removeClass('hidden');
        $more_link.remove();
    });

    filters.summarise = function(str, klass, more) {
        // Truncates a long description into a visible portion and hidden portion.
        // Clicking on a "more" link reveals the hidden portion.
        var lines = str.split('\n');
        var firstLine = lines[0].replace(/<(?:.|\n)*?>/g, '').replace(/\..*:\s+/g, '.');
        console.log(firstLine);
        lines.splice(0, 1);  // Remove first line now that we've stored it.

        return nunjucks.env.render('_includes/truncated.html', {
            'class': klass,
            'hidden_lines': lines,
            'more': more,
            'visible_line': firstLine,
        });
    };

    // Functions provided in the default context.
    var helpers = {
    };

    // Put the helpers into the nunjucks global.
    for (var i in helpers) {
        if (helpers.hasOwnProperty(i)) {
            globals[i] = helpers[i];
        }
    }

    return helpers;
});
