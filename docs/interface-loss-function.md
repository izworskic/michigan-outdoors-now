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

## Fatal regressions

A release fails if the homepage starts with the map, drops a required intent path, leaks architecture jargon into the main experience, omits part of the decision, or flattens specialist activities into one generic score.
