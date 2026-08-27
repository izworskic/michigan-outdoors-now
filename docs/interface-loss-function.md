# Michigan Outdoors Now — Persona / Task Interface Loss

Status: release gate  
Direction: **lower is better**  
Release target: **<= 18 / 100**  
Flagship target: **<= 10 / 100**

The homepage is evaluated against whether a normal person can reach a useful Michigan outdoor decision without understanding our architecture.

## Loss terms

- **Intent recognition — 20:** the four primary planning situations must be obvious.
- **Time to value — 20:** no map, location, setup form, or architecture lesson before initial value.
- **Architecture jargon — 15:** primary copy should not use internal terms such as decision-ready, DNR layer, discovery universe, structured context, or data model.
- **Decision completeness — 15:** where, when, why, watch-out, and alternative.
- **Personalization friction — 10:** location and drive time refine a result after value appears.
- **Activity truth — 10:** specialist-dependent activities use specialist data.
- **Recovery and alternatives — 5:** empty results and weak conditions have a useful next move.
- **Visual hierarchy — 5:** intent first, answer second, supporting detail third.

## Required user situations

1. I want to get outside today.
2. Help me plan this weekend.
3. I already know the place.
4. I know what I want to do.

## Statewide atlas contract

The explorer must not visually imply that the curated full-planning places are the extent of Michigan outdoor access.

The atlas can combine several source-backed layers with different meanings:

- full trip-planning places
- Michigan DNR trail systems and route geometry
- temporary trail closures and reroutes
- the existing Michigan Boat Launches source-qualified public-access inventory

Boat launches are clustered at statewide zoom and resolve into individual access points as the user zooms. They are access infrastructure, not promoted into destination scores simply because a coordinate exists.

The launch adapter inherits the source-truth rules of the existing launch tool: missing facility fields remain unknown rather than zero, and a source failure produces no guessed launch pins.

## Travel-range contract

The maximum one-way drive is an inclusive radius from 1 through 8 hours. Selecting 8 hours means every qualifying option from nearby through 8 hours away can compete; it does not target only the eighth hour.

## Fatal regressions

A release fails if the homepage starts with the map, drops a required intent path, leaks architecture jargon into the main experience, omits part of the decision, flattens specialist activities into one generic score, turns unknown launch attributes into zero, or reduces statewide discovery back to the curated place set alone.
