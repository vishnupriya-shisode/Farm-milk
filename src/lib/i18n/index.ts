import type { AstroCookies } from 'astro';
import en from './en.json';
import mr from './mr.json';

export const LANG_COOKIE = 'milk_lang';
export type Lang = 'en' | 'mr';

const dictionaries: Record<Lang, Record<string, unknown>> = { en, mr };

function lookup(dict: Record<string, unknown>, path: string): unknown {
	return path.split('.').reduce<unknown>((node, key) => {
		if (node && typeof node === 'object' && key in node) {
			return (node as Record<string, unknown>)[key];
		}
		return undefined;
	}, dict);
}

export function getLang(cookies: AstroCookies): Lang {
	const value = cookies.get(LANG_COOKIE)?.value;
	return value === 'mr' ? 'mr' : 'en';
}

export function makeT(lang: Lang) {
	return function t(key: string): string {
		const value = lookup(dictionaries[lang], key) ?? lookup(dictionaries.en, key);
		return typeof value === 'string' ? value : key;
	};
}

export type TFunction = ReturnType<typeof makeT>;
