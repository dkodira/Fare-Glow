# Site-wide French language option

## Goal

Let Fare Glow users switch the entire app interface between English and French from a language selector in the top-right navigation. Keep the selected language across page navigation and later visits on the same device.

## Scope

Translate Fare Glow-authored interface text on the flight search, How it works, and Feedback pages. This includes navigation, headings, descriptions, form labels, buttons, help text, dialogs, validation and error messages, empty states, and status text around dynamic search results. Format app-generated dates in French when French is selected.

Keep brand/product names, airport and airline names, user-entered search values, and user-submitted feedback in their original form. The feature will not use a machine translation service or send page content to an external translation provider.

## Design

- Add a shared locale state for `en` and `fr` at the app level so all three pages use one selection.
- Add an accessible compact language selector in the top-right navigation on all three pages.
- Persist the selected locale in local storage and initialize it safely on the client, with English as the default.
- Translate visible app-owned strings through reviewed English and French message dictionaries. Use interpolation for values such as counts, prices, and dates rather than assembling translated sentences from English fragments.
- Set the document language to match the selected locale for assistive technology and browser language handling.
- Keep airport/city/airline names, user-authored feedback, and user-provided search input unchanged.

## Page behavior

- **Flight search:** Translate all controls, filters, navigation, explanatory content, result labels, result actions, authentication/provider-key dialogs, account and API usage messages, history labels, and footer text. Keep route names, airline names, and fare amounts/currency unchanged. Format dates and locale-sensitive date/time strings for French.
- **How it works:** Translate its navigation, headings, explanatory copy, workflow steps, and footer.
- **Feedback:** Translate form labels, category options, notices, loading/error/empty states, and page navigation. Preserve submitted feedback text and category values as posted; translate the surrounding interface only.

## Accessibility and persistence

The selector will have a clear accessible label and keyboard-operable native control. The selected locale will be saved locally and restored on page load. Before the saved locale is read, render English to avoid server/client mismatch; switch after client initialization.

## Acceptance criteria

1. A user can select Français from the top-right control on any of the three pages.
2. The current page updates without a full page reload, and navigation to another page preserves the selection.
3. Reloading the site on the same device restores the chosen language.
4. All Fare Glow-authored visible interface text on the three pages is available in French, including asynchronous states and dialogs.
5. User feedback and entered airport/airline/location names remain unchanged.
6. The document language reflects the selected locale, and the selector works with keyboard and assistive technology.

## Out of scope

- Translating user-generated feedback or third-party flight/airport/airline data.
- URL-based locales, server-side locale negotiation, or automatic browser-language detection.
- Adding languages other than English and French.
- Changing the flight search, account, or feedback business logic.
