# Lead Archive Inventory

Measured 2026-10-01 by `scripts/index-archive.ts` over 6,788 unique CSV exports
(9.38 GB). Read-only; nothing was written to any database.

Reproduce with:

```bash
npx tsx scripts/index-archive.ts --files-from files.txt --out unique-people.ndjson
```

## Headline

```
4,783,727 rows across 6,788 files
  3,077,531 duplicates (64%)
    473,263 unusable (10%)
  ─────────
  1,232,933 DISTINCT PEOPLE
```

**The row count is a claim about files, not about people.** Export archives
overlap heavily: the same person is pulled into a regional file, a campaign
file and several refreshes. Two thirds of this archive was the same people
counted again.

Identity for dedup, strongest first: LinkedIn URL → email → name + company
domain → name + company. This errs toward *over*-counting, which is the honest
direction when the number is used to decide what to buy.

## Why rows were unusable

| Reason | Rows |
|---|---|
| `no_country` | 452,520 |
| `no_resolvable_identity` | 12,576 |
| `no_identity` | 8,134 |
| `no_name` | 33 |

Country accounts for 96% of discards. Country is the primary search filter, so
a row without one cannot be served by a country-scoped search. **Open question:
whether that field is genuinely empty in the exports or whether the mapping in
`profile-mapper.ts` misses a spelling.** Worth checking before concluding
450k contacts are unusable.

## Field coverage, of distinct people

| Field | Coverage |
|---|---|
| company domain | 100% |
| job title | 100% |
| industry | 99% |
| email | 96% |
| linkedin url | 64% |
| employee count | 63% |

Domain and title at ~100% is what makes this archive searchable at all, and
domain at 100% is what lets `email-patterns` generate an address for nearly
every row.

## By country

| Country | People | VP and above |
|---|---|---|
| US | 590,144 | 489,841 |
| GB | 190,339 | 146,687 |
| AE | 136,427 | 73,584 |
| SA | 87,155 | 34,672 |
| EG | 40,514 | 15,459 |
| IN | 37,905 | 19,317 |
| TR | 24,517 | 21,904 |
| DE | 23,547 | 18,401 |
| LB | 16,876 | 7,027 |
| FR | 16,736 | 14,207 |
| QA | 15,424 | 5,767 |
| JO | 14,162 | 5,925 |
| KW | 11,573 | 5,595 |
| OM | 9,547 | 4,043 |
| BH | 8,632 | 3,489 |

**Gulf and wider MENA total roughly 300,000 people, ~140,000 of them decision
makers.** That is the regionally differentiated part of this asset and the part
the global vendors cover worst.

## By seniority

| Band | People | Share |
|---|---|---|
| founder | 538,910 | 44% |
| c_suite | 252,357 | 20% |
| manager | 184,813 | 15% |
| director | 108,414 | 9% |
| vp | 70,954 | 6% |
| head | 30,561 | 2% |
| everything else | 46,924 | 4% |

**70% is founder, C-suite or VP.** Most prospect databases are bottom-heavy;
this one is the opposite. The 44% founder share reflects an SME-weighted
archive, and is the reason `firstname@` dominates the email patterns below.

## By company size

| Band | People |
|---|---|
| unknown | 456,511 |
| 1-10 | 292,572 |
| 11-50 | 215,500 |
| 51-200 | 108,231 |
| 1001-5000 | 75,024 |
| 201-500 | 50,397 |
| 501-1000 | 25,489 |
| 10000+ | 5,572 |
| 5001-10000 | 3,637 |

37% unknown is the weakest dimension. Size is a common filter, so this is the
first field worth enriching.

## By industry (top 20 of 147)

| Industry | People |
|---|---|
| information technology & services | 211,319 |
| construction | 73,800 |
| pharmaceuticals | 62,797 |
| management consulting | 50,435 |
| marketing & advertising | 47,243 |
| financial services | 37,890 |
| oil & energy | 37,655 |
| logistics & supply chain | 29,939 |
| machinery | 27,347 |
| insurance | 25,633 |
| electrical/electronic manufacturing | 23,222 |
| hospital & health care | 23,148 |
| real estate | 22,315 |
| research | 21,185 |
| food & beverages | 21,141 |
| retail | 20,336 |
| events services | 19,132 |
| food production | 17,888 |
| accounting | 17,084 |
| telecommunications | 15,891 |

## Email patterns learned from the same archive

Measured by `scripts/mine-email-patterns.ts` over the same files.

```
767,166 distinct domains
724,976 with a learned pattern (95%)
224,697 with 5+ contacts of evidence (31%)
```

Pattern distribution, restricted to domains with 5+ contacts so the figure is
not dominated by single-address domains:

| Pattern | Share |
|---|---|
| `first` — `ahmed@` | 45% |
| `first.last` | 27% |
| `flast` — `akhan@` | 15% |
| everything else | 13% |

`first.last` leads in US corporate data and was the expected winner. It is not
the winner here. `firstname@` dominates because the archive is SME-weighted,
and this was verified against raw rows rather than assumed to be a bug:

```
Yazan Al-darabseh   yazan@skyenergy.sa
Shehzad Chishti     shehzad@ugc.com.sa
Gireesh Kumar       gireesh@newtrend.ae
```

Commercially this is favourable: `first` is a single cheap guess, so resolving
a new person at such a domain costs roughly one verification credit rather than
six.

## The confidence ceiling

**Every pattern here is capped at confidence 50, and none reach 70.**

That is `email-patterns` working as designed. These are vendor exports with no
verification history attached, so every observation counts as `unverified`. The
engine refuses to launder a previous vendor's guess into our own confidence
score — see the ceilings documented in `src/lib/email-patterns.ts`.

The ceiling lifts on its own as this platform's verification results and bounce
feedback accumulate against these domains. The *structure* is established; the
*proof* comes from sending.

## What this implies

1. **No more data needs buying to launch search.** 1.23M people, 70% senior,
   ~100% title and domain coverage is a product.
2. **The Gulf segment is the differentiated asset**, and is where registry
   sources (Wathq, chamber directories) would extend coverage that no global
   vendor sells well.
3. **Size enrichment is the highest-value gap** at 37% unknown.
4. **The `no_country` discard needs investigating** before 450k rows are written
   off.

## Outputs

Both are gitignored working files, regenerated by the scripts above:

- `unique-people.ndjson` — 746 MB, the deduped set, shaped for
  `scripts/load-discovery-profiles.ts`
- `patterns-all.ndjson` — 724,976 learned domain patterns, shaped for
  `domain_email_patterns`

Neither has been loaded. `discovery_profiles` and `domain_email_patterns` are
written but unapplied, pending database access.
