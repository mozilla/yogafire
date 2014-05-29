define('yogashots', ['log', 'z'], function(log, z) {

    var console = log('yogashots');

    function initShots() {
        $('.slider').each(function(i, elm) {
            var $container = $(elm);
            var $prev = $('<button class="ssnav prev" data-action="prev">&lsaquo;</button>'),
                $next = $('<button class="ssnav next" data-action="next">&rsaquo;</button>');
            var $previews = $container.find('.content li');
            var current = 0;

            if ($previews.length) {
                $container.find('.prev, .next').remove();
                $container.append($prev, $next);
                show(current, $previews, $prev, $next);
            }

            $container.on('click', '.ssnav', function(e) {
                e.preventDefault();
                z.win.trigger('image_defer');

                if ($(this).hasClass('prev')) {
                    show(--current, $previews, $prev, $next);
                } else {
                    show(++current, $previews, $prev, $next);
                }
            });
        });
    }

    function show(i, $previews, $prev, $next) {
        $previews.removeClass('current').hide().eq(i)
                 .show().addClass('current');
        setHandleState(i, $previews, $prev, $next);
        setCurrentDot(i, $previews);
    }

    function setCurrentDot(current, $previews) {
        var $dots = $previews.closest('.tray.previews').find('.dots b');
        $dots.removeClass('current');
        $dots.eq(current).addClass('current');
    }

    function setHandleState(current, $previews, $prev, $next) {
        $prev.hide();
        $next.hide();

        if (current < ($previews.length - 1)) {
            $next.show();
        }
        if (current > 0) {
            $prev.show();
        }
    }

    z.page.on('inittray', function() {
        // setTimeout always knows when DOMContentLoaded.
        setTimeout(initShots, 0);
    });

});
