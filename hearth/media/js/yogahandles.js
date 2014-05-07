define('yogahandles', ['z'], function(z) {
    function attachHandles(slider, $container) {
        $container.find('.prev, .next').remove();

        var $prevHandle = $('<button class="ssnav prev" data-action="prev">&#10216;</button>'),
            $nextHandle = $('<button class="ssnav next" data-action="next">&#10217;</button>');

        function setHandleState() {
            $prevHandle.hide();
            $nextHandle.hide();

            if (slider.hasNext()) {
                $nextHandle.show();
            }
            if (slider.hasPrev()) {
                $prevHandle.show();
            }
        }

        slider.element.addEventListener('fsmoveend', setHandleState);

        setHandleState();
        $container[0].slider = slider;
        $container.append($prevHandle, $nextHandle);
    }

    z.body.on('click', '.ssnav', function(e) {
        e.preventDefault();
        var slider = this.parentNode.slider;
        if (this.classList.contains('prev')) {
            slider.toPrev();
        } else {
            slider.toNext();
        }
    });

    return {attachHandles: attachHandles};
});
