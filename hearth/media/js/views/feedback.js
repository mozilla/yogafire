define('views/feedback',
       ['buckets', 'capabilities', 'forms', 'l10n', 'notification', 'requests', 'settings', 'templates', 'urls', 'utils', 'z'],
       function(buckets, caps, forms, l10n, notification, requests, settings, nunjucks, urls, utils, z) {

    var gettext = l10n.gettext;

    z.page.on('submit', '.feedback-form', function(e) {
        e.preventDefault();

        var $this = $(this);
        var data = utils.getVars($this.serialize());
        data.chromeless = caps.chromeless ? 'Yes' : 'No';
        data.from_url = window.location.pathname;
        data.profile = buckets.profile;

        forms.toggleSubmitFormState($this);

        requests.post(urls.api.url('feedback'), data).done(function(data) {
            $this.find('textarea').val('');
            forms.toggleSubmitFormState($this, true);
            $('.cloak').trigger('dismiss');
            notification.notification({message: gettext('Feedback submitted. Thanks!')});
        }).fail(function() {
            forms.toggleSubmitFormState($this, true);
            if (z.onLine) {
                notification.notification({
                    message: gettext('Sorry, there was an issue submitting your feedback. Please try again later.')
                });
            } else {
                notification.notification({message: settings.offline_msg});
            }
        });
    });

    // Init desktop feedback form modal trigger.
    function addFeedbackModal() {
        if (!caps.widescreen()) return;
        if (!$('.main.feedback:not(.modal)').length && !$('.feedback.modal').length) {
            z.page.append(nunjucks.env.render('settings/feedback.html'));
        }
        z.body.trigger('decloak');
    }

    z.body.on('click', '.submit-feedback', function(e) {
        e.preventDefault();
        e.stopPropagation();
        // Focus the form if we're on the feedback page.
        if ($('.main.feedback:not(.modal)').length) {
            $('.simple-field textarea').trigger('focus');
            return;
        }
        addFeedbackModal();
        $('.feedback.modal').addClass('show');
    });

    return function(builder) {
        builder.start('settings/feedback.html').done(function() {
            $('.feedback').removeClass('modal');
            addFeedbackModal();
        });

        builder.z('type', 'leaf');
        builder.z('title', gettext('Feedback'));
        builder.z('parent', urls.reverse('homepage'));
    };
});
