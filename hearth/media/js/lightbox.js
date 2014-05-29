define('lightbox',
    ['db', 'keys', 'models', 'navigation', 'utils', 'tracking', 'underscore', 'z'],
    function(db, keys, models, navigation, utils, tracking, _, z) {

    var $lightbox = $(document.getElementById('lightbox'));
    var $section = $lightbox.find('section');
    var $content = $lightbox.find('.content');
    var currentApp;
    var previews;

    $lightbox.addClass('shots');

    function showLightbox() {
        console.log('Opening lightbox');

        if (z.context.type === 'leaf') {
            tracking.trackEvent('App view interactions', 'click', 'Screenshot view');
        } else if (z.context.type === 'search') {
            tracking.trackEvent(
                'Category view interactions',
                'click',
                'Screenshot view'
            );
        }

        var $this = $(this);
        var which = $this.closest('li').index();
        var $tray = $this.closest('.tray');
        var $tile = $tray.prev();

        // We get the screenshots from the associated tile. No tile? bail.
        if (!$tile.hasClass('mkt-tile')) return;

        db.get.app($tile.data('slug')).done(function(product) {
            var id = product.id;

            if (id != currentApp) {
                currentApp = id;
                previews = product.previews;
                renderPreviews();
            }

            navigation.modal('lightbox');

            // Fade that bad boy in.
            z.body.addClass('overlayed');
            $lightbox.show().addClass('show');
        });
    }

    function renderPreviews() {
        // Clear out the existing content.
        $content.empty();

        // Place in a pane for each image/video with a 'loading' placeholder.
        _.each(previews, function(p) {
            var $el = $('<li class="loading"><span class="throbber">');
            $content.append($el);

            var i = new Image();

            i.onload = function() {
                $el.removeClass('loading');
                $el.append(i);
            };

            i.onerror = function() {
                $el.removeClass('loading');
                $el.append('<b class="err">&#x26A0;</b>');
            };

            // Attempt to load the image.
            i.src = p.image_url;
        });
    }

    function hideLightbox() {
        navigation.closeModal('lightbox');
        closeLightbox();
    }

    function closeLightbox() {
        z.body.removeClass('overlayed');
        $lightbox.removeClass('show');
    }

    // If a tray thumbnail is clicked, load up our lightbox.
    z.page.on('click', '.tray ul a', utils._pd(showLightbox));

    // Dismiss the lighbox when we click outside it or on the close button.
    $lightbox.on('click', function(e) {
        if ($(e.target).is('#lightbox')) {
            hideLightbox();
            e.preventDefault();
        }
    }).on('dragstart', function(e) {
        e.preventDefault();
    });
    $lightbox.find('.close').on('click', utils._pd(hideLightbox));

    z.win.on('closeModal', function (e, modalName) {
        if (modalName === 'lightbox') {
            closeLightbox();
        }
    });

});
