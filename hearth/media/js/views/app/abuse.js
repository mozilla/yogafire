define('views/app/abuse',
       ['forms', 'l10n', 'notification', 'requests', 'urls', 'utils', 'z'],
       function(forms, l10n, notification, requests, urls, utils, z) {

    var gettext = l10n.gettext;

    z.page.on('submit', '.abuse-form', function(e) {
        e.preventDefault();
        // Submit report abuse form
        var $this = $(this);
        var slug = $this.find('input[name=app]').val();
        var data = utils.getVars($this.serialize());

        forms.toggleSubmitFormState($this);

        requests.post(urls.api.url('app_abuse'), data).done(function(data) {
            notification.notification({message: gettext('Abuse reported')});
            z.page.trigger('navigate', urls.reverse('app', [slug]));
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

    return function(builder, args) {
        builder.start('detail/abuse.html', {slug: args[0]}).done(function() {
            $('.report-abuse').removeClass('modal');
        });

        builder.z('type', 'leaf');
        builder.z('parent', urls.reverse('app', [args[0]]));
        // L10n: Report abuse regarding an app
        builder.z('title', gettext('Report Abuse'));
    };
});
