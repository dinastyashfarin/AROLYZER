import { pageContent } from '../content.jsx';

// The choices shown in the form. Edit the words in content/<lang>/waitlist.json under "choices".
var EN = pageContent('waitlist', 'en').choices;
export var ROLES = EN.roles;
export var OPS = EN.operations.map(function (o) { return [o.label, o.note]; });
export var TONS = EN.tonnage;

export var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
