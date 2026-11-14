// Where the public sign-up forms send people. Both go to Kit (email); nothing is stored in SimDesk's own database.
// Paste each Kit form's subscribe URL here (https://app.kit.com/forms/<id>/subscriptions). Until then the forms
// tell visitors sign-ups are not open yet, and nothing is sent anywhere.
// Kit custom fields to create, used by the beta form: how_you_play, how_you_play_other, sims_tracked,
// tracking_now, quit_last_tracker, save_description, share_link, pc_or_mac, beta_email_ok (required checkbox), mailing_list (optional checkbox; add people to the news list in Kit when it is yes). The waitlist form uses: tracks_uniquely.
export const KIT = {
  waitlist: '',
  beta: '',
} as const;
