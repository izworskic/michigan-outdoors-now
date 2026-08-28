# Persona-led taste system

## What the tool is

Michigan Outdoors Now is not primarily a tourism homepage and it is not a directory.

It is a **field decision instrument** for a person asking: “Given where I am, how far I will go, and the kind of outdoor day I want, what should I seriously consider?”

The interface should therefore spend its visual budget on the decision, not on the product identity.

## Research signals

The taste model is informed by:

- Outdoor Industry Association 2026 participation research: outdoor participation is at a record high while average outing frequency is lower than in 2019. This means the market is broader and more casual, so the interface cannot assume expert outdoor-planning habits.
- OIA 2026 hiking research: hiking is both a major gateway activity and a growing core activity, so the same tool must support quick casual selection and deeper comparison.
- Michigan DNR statewide recreation research: Michigan outdoor behavior spans parks, sightseeing, hiking, fishing, wildlife viewing, paddling, camping and more. The product needs activity-neutral navigation.
- AllTrails map behavior: map selection surfaces the trail card immediately and detail expands from that card rather than replacing the search context.

## Primary personas

### 1. The spontaneous Michigan local

**Job:** “I have some time. Give me a good outdoor idea without making me research ten sites.”

Typical constraints:
- knows the starting area
- may only have a few hours
- does not know destination names
- wants confidence quickly

Taste implications:
- first useful results must appear immediately
- distance and “why this fits” outrank descriptive branding
- no need to learn the interface before seeing value

### 2. The activity-led outdoor regular

**Job:** “I know what I want to do. Show me the strongest places that fit.”

Examples: long hike, trout water, paddle, ski, birding.

Typical constraints:
- compares multiple candidates
- is willing to travel farther for a better experience
- wants to move quickly through results

Taste implications:
- all returned places remain reachable
- previous/next navigation is explicit
- active card remains visible
- category, drive time and match reason are scannable without opening detail

### 3. The Michigan explorer

**Job:** “I do not know this part of Michigan. Help me understand what is worth the drive.”

Typical constraints:
- may accept 2–8 hour travel
- needs geographic orientation
- wants discovery but not a generic attractions list

Taste implications:
- map stays visible
- place + area + travel cost are always paired
- progressive detail provides confidence after the result catches attention

### 4. The low-friction group planner

**Job:** “Find something everyone can agree on without making me operate a complicated outdoor app.”

Typical constraints:
- family, partner or group
- may not know activity terminology
- needs large targets and obvious navigation

Taste implications:
- one dominant result surface at a time
- no hidden card stack below decorative UI
- navigation must work one-handed on mobile
- orientation controls remain available but secondary

## Taste rules

1. **Returned data wins.** Once results exist, results become the primary visual layer.
2. **Branding yields.** Michigan Outdoors Now becomes a compact orientation mark during result mode.
3. **No dead vertical space.** Large headlines, banners or empty chrome cannot push decisions below the fold.
4. **Map + cards are one system.** Card selection recenters the map; map selection keeps the corresponding card reachable.
5. **Progressive disclosure.** Cards answer “what / where / how far / why.” Detail answers the rest.
6. **Continuous navigation.** Opening detail must not strand the user. Previous, next and the result rail remain available.
7. **All real results are reachable.** Do not announce 13 possibilities and render only 8.
8. **Mobile is the field interface.** Returned cards must occupy the visible viewport immediately after search.

## Visual hierarchy in result mode

1. Result set and active place
2. Search query / location context
3. Map geography
4. Actions and deeper planning
5. Brand / atlas / layer controls

The first three should be understandable in a glance.
