"""
Builds the bundled everyday-foods list (ROADMAP 2.15, spec §6.1) -> apps/mobile/assets/foods/builtin-foods.json

Sources (download into apps/mobile/scripts/food-data/, git-ignored):
  - UK CoFID 2021 Excel (gov.uk, Open Government Licence v3.0)          -> food-data/cofid-2021.xlsx
  - USDA FoodData Central SR Legacy CSV (public domain, CC0)            -> food-data/sr/<unzipped folder>/
  - USDA FoodData Central Foundation Foods CSV (public domain, CC0)     -> food-data/fnd/<unzipped folder>/

Rules:
  - CoFID is the main source: every CoFID food is kept.
  - USDA foods fill gaps: a USDA food is dropped when its name matches a CoFID food (token-set similarity), unless
    food-merge-overrides.csv says `keep`; `skip` rows always drop a USDA food.
  - Carbohydrate is "available carbohydrate" (CoFID basis): USDA carbohydrate-by-difference minus fibre.
  - Sodium (mg) -> salt (g) via salt = sodium x 2.5 / 1000.
  - Unknown values stay null ("N" in CoFID, missing in USDA); CoFID "Tr" (trace) -> 0.
  - A USDA food closer than HIDE_SIMILARITY to a CoFID food gets `hidden_by` = that CoFID id (search hides it when
    the CoFID food also matches the query).
  - Ids never change between versions: cofid:<food code>, usda:<fdc_id>.

Writes food-data/food-merge-report.csv (USDA foods dropped as duplicates, with the CoFID match) for review.
Usage: python apps/mobile/scripts/build-food-db.py
"""
import csv
import datetime
import glob
import json
import os
import re
import sys
import unicodedata

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'food-data')
OUT = os.path.join(HERE, '..', 'assets', 'foods', 'builtin-foods.json')
OVERRIDES = os.path.join(HERE, 'food-merge-overrides.csv')
REPORT = os.path.join(DATA, 'food-merge-report.csv')
DUPLICATE_SIMILARITY = 0.75
# Looser: USDA foods this close to a CoFID food are kept but hidden in search when that CoFID food also matches.
HIDE_SIMILARITY = 0.5
MAX_SERVINGS = 6

STOPWORDS = {'and', 'or', 'with', 'without', 'in', 'of', 'the', 'a', 'to', 'for', 'nfs', 'ns', 'as', 'type'}


def tokens(name):
    s = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    out = set()
    for t in re.findall(r'[a-z0-9]+', s):
        if t in STOPWORDS:
            continue
        if len(t) > 3 and t.endswith('es') and not t.endswith('ses'):
            t = t[:-2]
        elif len(t) > 3 and t.endswith('s'):
            t = t[:-1]
        out.add(t)
    return frozenset(out)


def search_name(name):
    s = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def num(v):
    """CoFID cell -> float | None. 'N' = no data, 'Tr' = trace (0)."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    v = str(v).strip()
    if v in ('', 'N'):
        return None
    if v == 'Tr':
        return 0.0
    try:
        return float(v.replace(',', ''))
    except ValueError:
        return None


def rnd(v, places=2):
    return None if v is None else round(v, places)


def sheet_rows(wb, name):
    rows = list(wb[name].iter_rows(values_only=True))
    codes = rows[1]  # machine codes row (WATER, PROT, ...)
    return codes, rows[3:]


def load_cofid():
    wb = openpyxl.load_workbook(os.path.join(DATA, 'cofid-2021.xlsx'), read_only=True)
    codes, prox = sheet_rows(wb, '1.3 Proximates')
    col = {c: i for i, c in enumerate(codes) if c}
    _, inorg = sheet_rows(wb, '1.4 Inorganics')
    sodium = {}
    for r in inorg:
        if r[0]:
            sodium[(str(r[0]).strip(), str(r[1]).strip())] = num(r[7])  # NA (mg); keyed with the name (see below)
    foods, seen = [], set()
    for r in prox:
        code, name, group = r[0], r[1], r[3]
        if not code or not name:
            continue
        code = str(code).strip()
        kcal = num(r[col['KCALS']])
        if kcal is None:
            continue
        fibre = num(r[col['AOACFIB']])
        if fibre is None:
            fibre = num(r[col['ENGFIB']])
        name = str(name).strip()
        na = sodium.get((code, name))
        # CoFID 2021 reuses a few food codes (e.g. 13-669 is both an aubergine dish and watercress): a repeated code
        # gets a stable name suffix so ids stay unique.
        fid = f'cofid:{code}' if code not in seen else f"cofid:{code}:{re.sub(r'[^a-z0-9]+', '-', search_name(name)).strip('-')}"
        seen.add(code)
        foods.append({
            'id': fid,
            'name': name,
            'source': 'cofid',
            # CoFID alcoholic beverages (group Q*) are per 100 ml.
            'basis': 'ml' if str(group or '').startswith('Q') else 'g',
            'kcal': rnd(kcal, 1),
            'protein_g': rnd(num(r[col['PROT']])),
            'carbs_g': rnd(num(r[col['CHO']])),
            'fat_g': rnd(num(r[col['FAT']])),
            'fibre_g': rnd(fibre),
            'sugars_g': rnd(num(r[col['TOTSUG']])),
            'sat_fat_g': rnd(num(r[col['SATFOD']])),
            'salt_g': rnd(na * 2.5 / 1000 if na is not None else None, 3),
            'servings': [],
        })
    return foods


def usda_dir(sub):
    found = glob.glob(os.path.join(DATA, sub, '*', 'food.csv'))
    if not found:
        sys.exit(f'Missing USDA data in food-data/{sub}/ (see the header of this script).')
    return os.path.dirname(found[0])


def read_csv(path):
    with open(path, encoding='utf-8') as f:
        return list(csv.DictReader(f))


def load_usda(sub, keep_type):
    d = usda_dir(sub)
    foods = {r['fdc_id']: r['description'] for r in read_csv(os.path.join(d, 'food.csv')) if r['data_type'] == keep_type}
    wanted = {'1008', '2047', '2048', '1003', '1004', '1005', '1079', '2000', '1063', '1258', '1093'}
    nut = {}
    for r in read_csv(os.path.join(d, 'food_nutrient.csv')):
        if r['fdc_id'] in foods and r['nutrient_id'] in wanted and r['amount'] != '':
            nut.setdefault(r['fdc_id'], {})[r['nutrient_id']] = float(r['amount'])
    units = {r['id']: r['name'] for r in read_csv(os.path.join(d, 'measure_unit.csv'))}
    portions = {}
    for p in read_csv(os.path.join(d, 'food_portion.csv')):
        if p['fdc_id'] not in foods or not p['gram_weight']:
            continue
        grams = float(p['gram_weight'])
        if grams <= 0:
            continue
        amount = float(p['amount']) if p['amount'] else 1.0
        unit = units.get(p['measure_unit_id'], '')
        unit = '' if unit in ('undetermined', '') else unit
        detail = (p['modifier'] or p['portion_description'] or '').strip()
        label = ' '.join(x for x in (f'{amount:g}', unit, detail) if x).strip()[:60]
        if label and label != f'{amount:g}':
            portions.setdefault(p['fdc_id'], []).append({'label': label, 'grams': round(grams, 1)})
    out = []
    for fid, name in foods.items():
        n = nut.get(fid, {})
        kcal = n.get('1008', n.get('2048', n.get('2047')))
        if kcal is None:
            continue
        fibre = n.get('1079')
        carbs = n.get('1005')
        if carbs is not None and fibre is not None:
            carbs = max(0.0, carbs - fibre)  # CoFID basis: available carbohydrate excludes fibre
        na = n.get('1093')
        sugars = n.get('2000', n.get('1063'))
        seen, servings = set(), []
        for s in portions.get(fid, []):
            if s['label'] not in seen:
                seen.add(s['label'])
                servings.append(s)
        out.append({
            'id': f'usda:{fid}',
            'name': name.strip(),
            'source': 'usda',
            'basis': 'g',
            'kcal': rnd(kcal, 1),
            'protein_g': rnd(n.get('1003')),
            'carbs_g': rnd(carbs),
            'fat_g': rnd(n.get('1004')),
            'fibre_g': rnd(fibre),
            'sugars_g': rnd(sugars),
            'sat_fat_g': rnd(n.get('1258')),
            'salt_g': rnd(na * 2.5 / 1000 if na is not None else None, 3),
            'servings': servings[:MAX_SERVINGS],
        })
    return out


def load_overrides():
    if not os.path.exists(OVERRIDES):
        return {}
    return {r['usda_id']: r['action'] for r in read_csv(OVERRIDES) if r.get('usda_id')}


def jaccard(a, b):
    return len(a & b) / len(a | b) if a and b else 0.0


def main():
    cofid = load_cofid()
    usda = load_usda('sr', 'sr_legacy_food') + load_usda('fnd', 'foundation_food')
    overrides = load_overrides()

    index = {}
    for f in cofid:
        for t in tokens(f['name']):
            index.setdefault(t, []).append(f)

    kept, dropped, report = [], 0, []
    for f in usda:
        uid = f['id'].split(':', 1)[1]
        action = overrides.get(uid)
        if action == 'skip':
            dropped += 1
            report.append([uid, f['name'], 'skip (override)', '', ''])
            continue
        tk = tokens(f['name'])
        best, score = None, 0.0
        for c in {id(c): c for t in tk for c in index.get(t, [])}.values():
            s = jaccard(tk, tokens(c['name']))
            if s > score:
                best, score = c, s
        if action != 'keep' and best is not None and score >= DUPLICATE_SIMILARITY:
            dropped += 1
            report.append([uid, f['name'], f'{score:.2f}', best['id'], best['name']])
            continue
        f['hidden_by'] = best['id'] if action != 'keep' and best is not None and score >= HIDE_SIMILARITY else None
        kept.append(f)

    for f in cofid:
        f['hidden_by'] = None
    foods = sorted(cofid + kept, key=lambda f: f['id'])
    ids = [f['id'] for f in foods]
    if len(ids) != len(set(ids)):
        sys.exit('Duplicate ids in the built-in list: ' + ', '.join(sorted({i for i in ids if ids.count(i) > 1})))
    for f in foods:
        f['name_search'] = search_name(f['name'])
        if f['hidden_by'] is None:
            del f['hidden_by']  # absent = not hidden (keeps the bundled file small)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    version = datetime.date.today().strftime('%Y%m%d')
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump({'version': version, 'foods': foods}, fh, ensure_ascii=False, separators=(',', ':'))
    # Tiny version file: the app checks it at startup and only loads the big list when it changed.
    with open(OUT.replace('.json', '.version.json'), 'w', encoding='utf-8') as fh:
        json.dump({'version': version}, fh)
    with open(REPORT, 'w', encoding='utf-8', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['usda_id', 'usda_name', 'similarity', 'cofid_id', 'cofid_name'])
        w.writerows(report)

    size = os.path.getsize(OUT)
    print(f'CoFID kept: {len(cofid)}')
    print(f'USDA added: {len(kept)} ({sum(1 for f in kept if f.get("hidden_by"))} hidden behind a CoFID match)  dropped as duplicates/skipped: {dropped}')
    print(f'Total foods: {len(foods)}  version {version}  file {size / 1e6:.2f} MB -> {os.path.relpath(OUT)}')
    print(f'Duplicate report: {os.path.relpath(REPORT)}')


if __name__ == '__main__':
    main()
