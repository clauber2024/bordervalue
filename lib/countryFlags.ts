// ISO 3166-1 alpha-2 lookup for Comex trade-partner country names as they
// appear in this app's data (Portuguese names, some English aliases).
// Shared between anywhere that needs to show the *real* flag of a country
// (Unicode regional-indicator emoji, an accurate depiction of the official
// flag) instead of an approximated color swatch.
const COUNTRY_ISO2: Array<[RegExp, string]> = [
  [/china/, 'CN'],
  [/estados unidos|united states/, 'US'],
  [/alemanha|germany/, 'DE'],
  [/espanha|spain/, 'ES'],
  [/taiwan/, 'TW'],
  [/argentina/, 'AR'],
  [/brasil|brazil/, 'BR'],
  [/japao|japan/, 'JP'],
  [/coreia do norte|north korea/, 'KP'],
  [/coreia|korea/, 'KR'],
  [/italia|italy/, 'IT'],
  [/franca|france/, 'FR'],
  [/canada/, 'CA'],
  [/marrocos|morocco/, 'MA'],
  [/russia/, 'RU'],
  [/nigeria/, 'NG'],
  [/bolivia/, 'BO'],
  [/trinidad|tobago/, 'TT'],
  [/peru/, 'PE'],
  [/mexico/, 'MX'],
  [/chile/, 'CL'],
  [/paraguai|paraguay/, 'PY'],
  [/uruguai|uruguay/, 'UY'],
  [/venezuela/, 'VE'],
  [/equador|ecuador/, 'EC'],
  [/guatemala/, 'GT'],
  [/panama/, 'PA'],
  [/costa rica/, 'CR'],
  [/honduras/, 'HN'],
  [/nicaragua/, 'NI'],
  [/el salvador/, 'SV'],
  [/republica dominicana|dominican republic/, 'DO'],
  [/cuba/, 'CU'],
  [/jamaica/, 'JM'],
  [/colombia/, 'CO'],
  [/singapura|singapore/, 'SG'],
  [/india/, 'IN'],
  [/paquistao|pakistan/, 'PK'],
  [/bangladesh/, 'BD'],
  [/vietna|vietnam/, 'VN'],
  [/indonesia/, 'ID'],
  [/tailandia|thailand/, 'TH'],
  [/malasia|malaysia/, 'MY'],
  [/filipinas|philippines/, 'PH'],
  [/holanda|paises baixos|netherlands/, 'NL'],
  [/portugal/, 'PT'],
  [/reino unido|united kingdom/, 'GB'],
  [/belgica|belgium/, 'BE'],
  [/suica|switzerland/, 'CH'],
  [/austria/, 'AT'],
  [/polonia|poland/, 'PL'],
  [/republica tcheca|czech/, 'CZ'],
  [/hungria|hungary/, 'HU'],
  [/romenia|romania/, 'RO'],
  [/ucrania|ukraine/, 'UA'],
  [/grecia|greece/, 'GR'],
  [/suecia|sweden/, 'SE'],
  [/noruega|norway/, 'NO'],
  [/dinamarca|denmark/, 'DK'],
  [/finlandia|finland/, 'FI'],
  [/irlanda|ireland/, 'IE'],
  [/israel/, 'IL'],
  [/turquia|turkey/, 'TR'],
  [/arabia saudita|saudi arabia/, 'SA'],
  [/emirados arabes|united arab emirates/, 'AE'],
  [/catar|qatar/, 'QA'],
  [/kuwait/, 'KW'],
  [/oma[ãa]/, 'OM'],
  [/egito|egypt/, 'EG'],
  [/argelia|algeria/, 'DZ'],
  [/tunisia/, 'TN'],
  [/africa do sul|south africa/, 'ZA'],
  [/angola/, 'AO'],
  [/mocambique|mozambique/, 'MZ'],
  [/quenia|kenya/, 'KE'],
  [/etiopia|ethiopia/, 'ET'],
  [/gana|ghana/, 'GH'],
  [/senegal/, 'SN'],
  [/costa do marfim|ivory coast/, 'CI'],
  [/camaroes|cameroon/, 'CM'],
  [/tanzania/, 'TZ'],
  [/zambia/, 'ZM'],
  [/australia/, 'AU'],
  [/nova zelandia|new zealand/, 'NZ'],
  [/cazaquistao|kazakhstan/, 'KZ'],
];

function normalizeCountryName(countryName: string): string {
  return countryName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function countryToIso2(countryName: string): string | null {
  const normalized = normalizeCountryName(countryName);
  return COUNTRY_ISO2.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

export function isoToFlagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function countryFlagEmoji(countryName: string): string | null {
  const iso2 = countryToIso2(countryName);
  return iso2 ? isoToFlagEmoji(iso2) : null;
}
