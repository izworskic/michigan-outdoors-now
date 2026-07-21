import type { ActivityId, DateChoice } from "../lib/types";

export type SearchGuide = {
  slug: string;
  title: string;
  shortTitle: string;
  entryLabel: string;
  entryDetail: string;
  eyebrow: string;
  description: string;
  directAnswer: string;
  audience: string;
  bestFor: string;
  planStart: string;
  weatherPivot: string;
  planner: {
    date: DateChoice;
    maxDriveHours: number;
    activities: ActivityId[];
    kids: boolean;
    dog: boolean;
    accessible: boolean;
  };
  tips: Array<{ title: string; text: string }>;
  checklist: string[];
  destinationIds: string[];
  faqs: Array<{ question: string; answer: string }>;
  relatedTool?: { label: string; url: string; description: string };
};

export const guides: SearchGuide[] = [
  {
    slug: "outdoors-today",
    title: "Things to Do Outside in Michigan Today",
    shortTitle: "Michigan outdoors today",
    entryLabel: "I just want a good plan today",
    entryDetail: "Start nearby and let current conditions narrow it down.",
    eyebrow: "For the spontaneous day-tripper",
    description:
      "Find practical things to do outside in Michigan today. Compare nearby hiking, beaches, birds, scenery, weather, wind, and air quality from your starting city.",
    directAnswer:
      "The best outdoor plan in Michigan today depends on your drive window, preferred activity, rain, wind, temperature, and air quality. Start with a Michigan city or ZIP, keep the first search inside one or two hours, and leave with both a primary plan and a weather backup.",
    audience: "Someone with a free day, or a free afternoon, who wants a confident answer without opening fifteen tabs.",
    bestFor: "Same-day choices, flexible interests, and a short drive.",
    planStart: "Today · up to 2 hours · hiking and scenery",
    weatherPivot: "Rain, gusts, heat, smoke, or a rough shoreline can move an inland option ahead of the original idea.",
    planner: { date: "today", maxDriveHours: 2, activities: ["hiking", "scenic"], kids: false, dog: false, accessible: false },
    tips: [
      { title: "Start close", text: "A one- or two-hour radius keeps the result useful for today instead of turning it into a future vacation list." },
      { title: "Choose two interests", text: "Pair a main activity with scenery or birding so the planner can find options that still feel worthwhile if conditions shift." },
      { title: "Keep a weather fork", text: "Choose a primary plan and an inland or lower-exposure backup before leaving home." },
    ],
    checklist: [
      "Confirm official hours, closures, parking, and seasonal access.",
      "Check the latest local forecast and AQI again before departure.",
      "For beaches or paddling, check the local marine forecast, waves, and water conditions.",
      "Download or open the official map before cell service becomes unreliable.",
    ],
    destinationIds: ["bay-city-state-park", "kensington-metropark", "belle-isle", "tawas-point", "hartwick-pines"],
    faqs: [
      { question: "Can this find outdoor activities near me in Michigan?", answer: "Yes. Enter a Michigan city or ZIP and set a one-hour drive for the most local results. The tool does not request or store device location." },
      { question: "Does the planner use today's weather?", answer: "It uses available forecast, gust, temperature, rain, and air-quality data to adjust the order. Conditions can change, so verify official sources before travel." },
      { question: "What if all three ideas look weather-sensitive?", answer: "Change the activity to hiking, birding, or scenery, or shorten the drive. A trip-fit score compares options; it is not a safety rating." },
    ],
  },
  {
    slug: "family-day-trips",
    title: "Michigan Outdoor Day Trips for Families",
    shortTitle: "Family outdoor day trips",
    entryLabel: "We need an easy family win",
    entryDetail: "Flexible places with more than one way to enjoy the day.",
    eyebrow: "For the family decision-maker",
    description:
      "Plan a Michigan outdoor family day trip by drive time, current conditions, and interests. Compare kid-friendly parks, beaches, short walks, wildlife, and scenery.",
    directAnswer:
      "A lower-stress Michigan family day trip usually combines a manageable drive with several activity options at one destination. Choose places that can support a short walk, wildlife or shoreline viewing, and an easy change of plan, then verify current facilities and access with the official source.",
    audience: "Parents, grandparents, and caregivers who need the outing to work for more than one age or attention span.",
    bestFor: "Flexible parks, short adventures, shoreline time, wildlife, and scenery.",
    planStart: "This weekend · up to 2 hours · hiking and scenery · kids",
    weatherPivot: "Heat, rain, AQI, and shoreline wind matter more when the group cannot simply push through a poor plan.",
    planner: { date: "weekend", maxDriveHours: 2, activities: ["hiking", "scenic"], kids: true, dog: false, accessible: false },
    tips: [
      { title: "Favor optionality", text: "A place with two or three activity types gives the group a useful fallback without another long drive." },
      { title: "Be honest about drive time", text: "Set the maximum one-way drive the least patient traveler can handle, not the theoretical family maximum." },
      { title: "Check the practical details", text: "Official pages remain the source for restrooms, fees, beach status, closures, and seasonal facility hours." },
    ],
    checklist: [
      "Confirm facilities, admission or vehicle-pass requirements, and current hours.",
      "Pack water, sun or rain protection, layers, snacks, and a simple change of clothes.",
      "Choose one must-do and one optional activity instead of over-scheduling.",
      "Keep the backup close enough that changing plans does not restart the whole day.",
    ],
    destinationIds: ["kensington-metropark", "lake-st-clair-metropark", "bay-city-state-park", "tawas-point", "tahquamenon-falls"],
    faqs: [
      { question: "What makes a Michigan outdoor destination family-friendly?", answer: "For this planner, it means the curated destination can work for a family outing and matches the selected activities. Always confirm current facilities, rules, and conditions on the official page." },
      { question: "Can I also require lower-barrier access?", answer: "Yes. Select lower-barrier access with the kids option. Read each access note and contact the destination when a specific route, surface, or facility is essential." },
      { question: "Are the family plans good in every season?", answer: "No destination works the same way year-round. Snow, ice, beach operations, insects, daylight, and facility schedules can all change the experience." },
    ],
  },
  {
    slug: "beach-day-trips",
    title: "Michigan Beach Day Trip Planner",
    shortTitle: "Michigan beach day trips",
    entryLabel: "I want a Great Lakes shore day",
    entryDetail: "Compare beaches with wind, rain, drive time, and backup options.",
    eyebrow: "For the shoreline seeker",
    description:
      "Plan a Michigan beach day trip from your city. Compare Great Lakes shoreline options by drive time, rain, wind gusts, air quality, scenery, and official access.",
    directAnswer:
      "The best Michigan beach for a day trip is the one inside a realistic drive window with suitable wind, weather, water, and access conditions. Use the planner to compare shore destinations, but use the local marine forecast and official beach information for safety decisions.",
    audience: "People who want sand, stones, dunes, lighthouse views, or a Great Lakes horizon without planning a full vacation.",
    bestFor: "Swimming-season ideas, shoreline walks, sunsets, stones, dunes, and lighthouse views.",
    planStart: "Tomorrow · up to 2 hours · beaches and scenery",
    weatherPivot: "Wind direction, gusts, waves, thunderstorms, smoke, and beach notices can outweigh a small difference in drive time.",
    planner: { date: "tomorrow", maxDriveHours: 2, activities: ["beaches", "scenic"], kids: false, dog: false, accessible: false },
    tips: [
      { title: "Treat the lake like open water", text: "Great Lakes conditions can change quickly. A pleasant air forecast does not replace wave, current, or beach-hazard information." },
      { title: "Compare exposure", text: "Gusts matter more on open beaches and points than they do on a protected inland walk." },
      { title: "Plan a dry-land backup", text: "Pair the beach with scenery, hiking, or birding so the trip still has value if entering the water is a poor choice." },
    ],
    checklist: [
      "Check official beach status, local marine forecasts, waves, currents, and thunder risk.",
      "Confirm parking, pass requirements, seasonal hours, and dog restrictions.",
      "Bring sun protection, drinking water, layers, and footwear for hot sand or rocky shoreline.",
      "Never interpret a trip-fit score as permission to enter the water.",
    ],
    destinationIds: ["holland-state-park", "grand-haven-state-park", "tawas-point", "sleeping-bear", "warren-dunes"],
    faqs: [
      { question: "Which side of Michigan has the best beaches?", answer: "Lake Michigan is known for broad sand and dunes, while Lake Huron and the Straits offer points, lighthouses, stones, and quieter stretches. The better day-trip choice depends on your starting point and current conditions." },
      { question: "Does low rain chance mean the water is safe?", answer: "No. Rain chance does not describe waves, currents, water temperature, beach hazards, or thunder nearby. Check local official water information." },
      { question: "Can I find dog-friendly Michigan beaches here?", answer: "Select the dog requirement, then confirm the exact pet area and leash rules. Many managed swim beaches exclude pets even when the larger park allows them." },
    ],
  },
  {
    slug: "hiking-day-trips",
    title: "Michigan Hiking Day Trip Planner",
    shortTitle: "Michigan hiking day trips",
    entryLabel: "I want a trail without overplanning",
    entryDetail: "Use drive time and weather to find a practical hiking direction.",
    eyebrow: "For the trail-day planner",
    description:
      "Find Michigan hiking day-trip ideas from your city. Compare drive time, rain, temperature, wind, AQI, scenery, access notes, maps, and official trail information.",
    directAnswer:
      "For a Michigan hiking day trip, first choose a realistic drive radius and the day, then compare rain, temperature, air quality, trail setting, and official access. The planner recommends destinations, not individual trail difficulty, so use the official map to choose the route that fits your group.",
    audience: "Casual walkers and hikers who know how far they will drive but have not chosen a park or recreation area.",
    bestFor: "Woodland walks, overlooks, dunes, waterfalls, wildlife areas, and flexible trail systems.",
    planStart: "This weekend · up to 2 hours · hiking and scenery",
    weatherPivot: "Heavy rain, heat, smoke, snow, ice, or strong exposure can make a shorter or more sheltered route the better day.",
    planner: { date: "weekend", maxDriveHours: 2, activities: ["hiking", "scenic"], kids: false, dog: false, accessible: false },
    tips: [
      { title: "Choose the destination first", text: "This tool narrows the region and park; the official trail map should determine distance, grade, surface, and route." },
      { title: "Match the forecast to exposure", text: "A windy shoreline bluff and a sheltered forest can feel very different under the same regional forecast." },
      { title: "Leave margin", text: "Drive estimates are rough and not live traffic. Keep daylight, parking, route-finding, and rest time outside the hiking estimate." },
    ],
    checklist: [
      "Open the official trail map and select a route within the group's ability.",
      "Check closures, hunting-season guidance, snow or ice, flooding, and daylight.",
      "Carry water, layers, navigation, insect protection, and a charged phone.",
      "Tell someone the destination and expected return when going into a remote area.",
    ],
    destinationIds: ["kensington-metropark", "hartwick-pines", "lumbermans-monument", "pictured-rocks", "porcupine-mountains"],
    faqs: [
      { question: "Does this planner rate Michigan trail difficulty?", answer: "No. It ranks destination fit. Trail length, grade, surface, and current condition must be checked on the official map or with the land manager." },
      { question: "Can I require dog-friendly hiking?", answer: "Yes. Select dog allowed, then verify leash rules, restricted areas, and seasonal rules with the official destination." },
      { question: "Why does rain affect the hiking order?", answer: "Higher rain chances can reduce comfort and may worsen mud, flooding, or slippery surfaces. The score is only a planning comparison, not a trail-condition report." },
    ],
  },
  {
    slug: "birding-day-trips",
    title: "Michigan Birding Day Trip Planner",
    shortTitle: "Michigan birding day trips",
    entryLabel: "I want birds and wildlife",
    entryDetail: "Wetlands, shoreline, forest, and migration stops within reach.",
    eyebrow: "For the wildlife watcher",
    description:
      "Plan a Michigan birding day trip from your city. Compare wetlands, shoreline, forest, drive time, current weather, gusts, AQI, access notes, and official refuge information.",
    directAnswer:
      "A useful Michigan birding day trip starts by matching habitat and season with a practical drive. Wetlands, Great Lakes points, shoreline parks, and northern forests offer different possibilities; weather and access can change the day, so verify current refuge or park notices.",
    audience: "New and experienced birders who want a strong habitat direction without pretending sightings are guaranteed.",
    bestFor: "Wetlands, migration points, shoreline birds, raptors, waterfowl, and relaxed wildlife observation.",
    planStart: "This weekend · up to 2 hours · birding and hiking",
    weatherPivot: "Wind, rain, heat, smoke, seasonal closures, and route access can matter as much as destination reputation.",
    planner: { date: "weekend", maxDriveHours: 2, activities: ["birding", "hiking"], kids: false, dog: false, accessible: false },
    tips: [
      { title: "Choose habitat, not a guaranteed species", text: "The guide points toward promising settings. Wildlife presence and visibility remain variable." },
      { title: "Respect refuge rules", text: "Seasonal closures, wildlife drives, pets, trail access, and hours can differ from a general recreation park." },
      { title: "Use weather as context", text: "Gusts and rain change comfort and visibility, while smoke or poor AQI may change how long you should remain outside." },
    ],
    checklist: [
      "Review the official map, hours, seasonal closures, and pet rules.",
      "Bring binoculars, quiet layers, water, insect protection, and a field guide or app.",
      "Keep distance from wildlife, nests, and closed habitat.",
      "Avoid broadcasting sensitive nesting locations or causing a crowd around wildlife.",
    ],
    destinationIds: ["shiawassee-nwr", "tawas-point", "whitefish-point", "seney-nwr", "bay-city-state-park"],
    faqs: [
      { question: "What are good Michigan birding habitats?", answer: "Managed wetlands, river floodplains, Great Lakes points, coastal marshes, dunes, and northern forest each support different birding opportunities." },
      { question: "Does the tool use live bird sightings?", answer: "No. It uses a curated destination catalog and current conditions, not a live sightings feed. Check current local reports where appropriate." },
      { question: "Can birding results include lower-barrier options?", answer: "Yes. Select lower-barrier access to favor destinations with accessible-friendly viewing options, then verify the exact route and facilities." },
    ],
  },
  {
    slug: "paddling-day-trips",
    title: "Michigan Kayaking and Paddling Day Trip Planner",
    shortTitle: "Michigan paddling day trips",
    entryLabel: "I want to paddle somewhere",
    entryDetail: "Compare rivers, inland water, and shore options with wind in view.",
    eyebrow: "For the water-day planner",
    description:
      "Plan a Michigan kayaking or paddling day trip by drive time and interests. Compare wind gusts, rain, temperature, AQI, river or shoreline settings, and official access.",
    directAnswer:
      "Choose a Michigan paddling destination only after matching the route and water type to your skills, equipment, wind, waves, flow, temperature, weather, and access. This planner can narrow destinations, but it cannot determine whether the water is safe to enter.",
    audience: "Paddlers looking for a destination direction who understand that local water information is the final decision source.",
    bestFor: "River access, inland lakes, protected water ideas, and Great Lakes possibilities for appropriately prepared paddlers.",
    planStart: "Tomorrow · up to 2 hours · paddling and scenery",
    weatherPivot: "Wind and gusts receive extra weight for paddling, but local waves, flow, water temperature, hazards, and skill fit still require separate checks.",
    planner: { date: "tomorrow", maxDriveHours: 2, activities: ["paddling", "scenic"], kids: false, dog: false, accessible: false },
    tips: [
      { title: "Name the water type", text: "A calm inland launch, moving river, and exposed Great Lakes route are not interchangeable plans." },
      { title: "Use the score only to compare", text: "A high trip-fit score never certifies water, weather, equipment, or skill conditions." },
      { title: "Build a land backup", text: "Pair paddling with scenery, hiking, or birding so a no-launch decision does not waste the whole trip." },
    ],
    checklist: [
      "Check the local marine forecast or river level, flow, hazards, and launch status.",
      "Use a properly fitted life jacket and carry required safety equipment.",
      "Match the route, water temperature, distance, and conditions to the least experienced paddler.",
      "Tell someone the route and return time; avoid paddling alone when conditions exceed your margin.",
    ],
    destinationIds: ["lake-st-clair-metropark", "au-sable-mio", "rifle-river", "brown-bridge", "pictured-rocks"],
    faqs: [
      { question: "Does this show live Michigan river levels or wave heights?", answer: "No. It uses forecast signals to compare destination fit. Follow the official water, marine, launch, and land-manager sources for the chosen route." },
      { question: "Why are gusts penalized more for paddling?", answer: "Wind can have a larger consequence on exposed water than on many land activities. The adjustment is a planning cue, not a complete water-safety model." },
      { question: "Can beginners use the paddling planner?", answer: "It can help narrow places, but beginners should choose instruction, equipment, and protected routes appropriate to their experience and verify all local conditions." },
    ],
  },
  {
    slug: "dark-sky-stargazing",
    title: "Michigan Dark Sky and Stargazing Trip Planner",
    shortTitle: "Michigan stargazing trips",
    entryLabel: "I’m chasing stars or northern lights",
    entryDetail: "Start with dark-sky places, cloud cover, and a realistic night drive.",
    eyebrow: "For the night-sky seeker",
    description:
      "Plan a Michigan dark-sky or stargazing trip. Compare dark-sky destinations by drive time, cloud cover, rain, wind, temperature, access notes, and official information.",
    directAnswer:
      "For a Michigan stargazing trip, prioritize dark location, cloud cover, moonlight, open viewing direction, official nighttime access, and a safe return drive. This planner weighs average cloud cover for dark-sky choices, but it cannot guarantee stars or northern lights.",
    audience: "Stargazers and aurora hopefuls who need a place decision, not another vague statewide list.",
    bestFor: "Dark-sky parks, open shoreline horizons, Milky Way planning, and aurora-viewing preparation.",
    planStart: "This weekend · up to 3 hours · dark skies and scenery",
    weatherPivot: "Cloud cover is the central forecast signal; rain, gusts, smoke, temperature, moonlight, and nighttime access also matter.",
    planner: { date: "weekend", maxDriveHours: 3, activities: ["dark-sky", "scenic"], kids: false, dog: false, accessible: false },
    tips: [
      { title: "Clouds beat reputation", text: "A famous dark-sky location under heavy cloud can be a worse choice than a closer clear horizon." },
      { title: "Plan the return drive", text: "Late-night fatigue, wildlife, cold, remote roads, and weak cell coverage belong in the plan before departure." },
      { title: "Separate stars from aurora", text: "Clear dark sky helps both, but an aurora also requires sufficient geomagnetic activity and a useful viewing direction." },
    ],
    checklist: [
      "Confirm nighttime access, parking, closing rules, and whether overnight use is prohibited.",
      "Check cloud cover, precipitation, temperature, wind, moon phase, and aurora forecast if relevant.",
      "Bring warm layers, a red light, charged phone, and offline directions.",
      "Use headlights responsibly and protect other visitors' night vision at viewing sites.",
    ],
    destinationIds: ["headlands", "wilderness-state-park", "whitefish-point", "pictured-rocks", "porcupine-mountains"],
    faqs: [
      { question: "Where can I see dark skies in Michigan?", answer: "Northern shoreline, designated dark-sky locations, remote Upper Peninsula areas, and some Lake Huron or Lake Michigan points can offer darker horizons. Confirm current access before traveling." },
      { question: "Does low cloud cover guarantee northern lights?", answer: "No. Clear sky only removes one obstacle. Aurora visibility also depends on geomagnetic activity, darkness, latitude, timing, and viewing direction." },
      { question: "Does the planner include the moon phase?", answer: "Not currently. Check moonrise, moonset, and illumination separately when faint stars or the Milky Way are the goal." },
    ],
    relatedTool: { label: "Northern Lights Michigan", url: "https://chrisizworski.com/northern-lights-michigan/", description: "Check Chris Izworski's focused Michigan aurora guide after choosing a viewing direction." },
  },
  {
    slug: "freighter-watching",
    title: "Michigan Freighter Watching Day Trip Planner",
    shortTitle: "Michigan freighter watching",
    entryLabel: "I want to see Great Lakes freighters",
    entryDetail: "Compare locks, riverfront, points, and shoreline viewing directions.",
    eyebrow: "For the shipwatcher",
    description:
      "Plan a Michigan Great Lakes freighter-watching trip. Compare the Soo Locks, riverfronts, points, and shoreline destinations by drive, weather, wind, and access.",
    directAnswer:
      "Michigan freighters can be watched from working waterways, riverfronts, Great Lakes points, and some harbor piers. The Soo Locks offers the clearest close-up shipwatching experience, while Detroit River, Whitefish Point, Marquette, Holland, and Grand Haven provide different shoreline perspectives.",
    audience: "First-time visitors, families, photographers, and dedicated vessel watchers choosing where the drive is worth it.",
    bestFor: "Soo Locks trips, river traffic, Great Lakes points, harbor approaches, and shoreline photography.",
    planStart: "Today · up to 3 hours · freighters and scenery",
    weatherPivot: "Visibility, rain, gusts, cold, smoke, and safe public access can change the value of an exposed viewing location.",
    planner: { date: "today", maxDriveHours: 3, activities: ["freighters", "scenic"], kids: false, dog: false, accessible: false },
    tips: [
      { title: "Pick the viewing style", text: "Locks, rivers, points, and piers provide very different distances, angles, schedules, and exposure." },
      { title: "Do not promise a ship", text: "Traffic changes. Use a live vessel or lock guide where available and keep scenery or birding as a second reason to go." },
      { title: "Respect working water", text: "Stay in public viewing areas and follow barriers, security rules, pier closures, and weather warnings." },
    ],
    checklist: [
      "Check official viewing hours, seasonal access, security rules, and current closures.",
      "Use a current vessel-tracking or lock resource without treating arrival estimates as guarantees.",
      "Bring binoculars, layers, and wind protection for exposed shoreline locations.",
      "Stay behind barriers and off closed, icy, flooded, or wave-washed structures.",
    ],
    destinationIds: ["soo-locks", "belle-isle", "whitefish-point", "presque-isle-marquette", "grand-haven-state-park"],
    faqs: [
      { question: "Where is the best place to see freighters in Michigan?", answer: "The Soo Locks is the strongest close-up destination. The St. Marys and Detroit rivers, Whitefish Point, Marquette, and Lake Michigan harbor approaches offer different views." },
      { question: "Does this tool show live ship locations?", answer: "The broad planner chooses a destination. Use the related Soo Locks guide or another current vessel source for ship movement, then verify public access." },
      { question: "Can I make a freighter trip family-friendly?", answer: "Yes. Add the kids requirement and scenery. The results will favor curated destinations that can work for a family outing." },
    ],
    relatedTool: { label: "Soo Locks live guide", url: "https://chrisizworski.com/soo-locks/", description: "Use Chris Izworski's focused Soo Locks tool for the live shipwatching layer." },
  },
  {
    slug: "dog-friendly-day-trips",
    title: "Dog-Friendly Michigan Outdoor Day Trips",
    shortTitle: "Dog-friendly Michigan trips",
    entryLabel: "The dog is coming too",
    entryDetail: "Start with places marked dog-friendly, then confirm exact rules.",
    eyebrow: "For the dog-included planner",
    description:
      "Plan dog-friendly outdoor day trips in Michigan by drive time, activity, weather, and access. Compare parks, trails, shoreline, and official pet rules.",
    directAnswer:
      "Many Michigan parks and recreation areas allow leashed dogs, but rules can change by beach, building, habitat, trail, and season. Use the dog requirement to narrow destinations, then verify the exact pet area and current rules with the official land manager.",
    audience: "People whose outing only works if the dog can legally and comfortably join the actual activity area.",
    bestFor: "Leashed trail walks, scenery, woodland parks, and selected shoreline areas.",
    planStart: "This weekend · up to 2 hours · hiking and scenery · dog",
    weatherPivot: "Heat, hot surfaces, cold, storms, smoke, water conditions, and limited shade can change whether a dog-friendly destination is a good dog day.",
    planner: { date: "weekend", maxDriveHours: 2, activities: ["hiking", "scenic"], kids: false, dog: true, accessible: false },
    tips: [
      { title: "Verify the exact zone", text: "A park can allow dogs while excluding them from a swim beach, building, sensitive habitat, or specific trail." },
      { title: "Plan for the dog's weather", text: "A human-comfortable forecast may still create hot pavement, little shade, cold water, or stressful storms." },
      { title: "Protect wildlife and other visitors", text: "Keep the dog controlled, carry waste bags and water, and follow leash and habitat rules." },
    ],
    checklist: [
      "Confirm leash length, pet zones, beach restrictions, buildings, fees, and seasonal rules.",
      "Bring water, bowl, waste bags, identification, and a suitable restraint.",
      "Check surface temperature, shade, ticks, wildlife, and water hazards.",
      "Have a backup that does not require leaving a pet unattended in a vehicle.",
    ],
    destinationIds: ["waterloo", "kensington-metropark", "tawas-point", "wilderness-state-park", "sleeping-bear"],
    faqs: [
      { question: "Are dogs allowed in Michigan state parks?", answer: "Pets are generally welcome in many Michigan state-managed recreation areas, but exceptions include designated swim beaches, sensitive habitat, buildings, and posted areas. Confirm the current rule for the exact place." },
      { question: "Does dog-friendly mean off-leash?", answer: "No. The planner's dog flag does not mean off-leash access. Expect leash and immediate-control requirements unless an official source clearly states otherwise." },
      { question: "Can I combine dog-friendly and lower-barrier access?", answer: "Yes. Select both requirements. Then read the access note and official pet rules because the usable route matters more than a park-wide label." },
    ],
  },
  {
    slug: "lower-barrier-outdoors",
    title: "Lower-Barrier and Accessible Outdoor Trips in Michigan",
    shortTitle: "Lower-barrier Michigan trips",
    entryLabel: "Access needs to lead the plan",
    entryDetail: "Favor lower-barrier viewing and read the exact access notes.",
    eyebrow: "For the access-first planner",
    description:
      "Find lower-barrier outdoor trip ideas in Michigan. Compare paved or improved viewing options, drive time, activities, current conditions, access notes, and official details.",
    directAnswer:
      "Accessible outdoor planning must happen at the route and facility level, not from a park-wide label. This planner can favor destinations with lower-barrier options, but visitors should verify surfaces, grades, parking, restrooms, viewing access, equipment, and seasonal conditions for their specific needs.",
    audience: "Disabled visitors, older adults, families with strollers, recovery-day travelers, and anyone who needs access details to shape the destination choice.",
    bestFor: "Improved viewpoints, paved routes, visitor-area access, wildlife drives, boardwalks, and shorter outings.",
    planStart: "This weekend · up to 2 hours · scenery and birding · lower-barrier access",
    weatherPivot: "Snow, ice, sand, flooding, water levels, heat, smoke, and facility closures can change an otherwise lower-barrier route.",
    planner: { date: "weekend", maxDriveHours: 2, activities: ["scenic", "birding"], kids: false, dog: false, accessible: true },
    tips: [
      { title: "Ask route-level questions", text: "Surface, width, slope, cross-slope, distance, resting places, parking, and restrooms matter more than a generic accessible symbol." },
      { title: "Read every access note", text: "The planner's filter is a starting point. The note explains known limitations and the official source confirms current details." },
      { title: "Account for the season", text: "Sand, snow, ice, flooding, construction, and water levels can change usable access without changing the destination description." },
    ],
    checklist: [
      "Review the official accessibility information and contact the site for essential details.",
      "Confirm parking, route surface and grade, distance, restrooms, seating, and seasonal operations.",
      "Check weather, AQI, heat, ice, flooding, and beach or boardwalk conditions.",
      "Keep a nearby backup that meets the same access requirements.",
    ],
    destinationIds: ["belle-isle", "lake-st-clair-metropark", "bay-city-state-park", "lumbermans-monument", "headlands"],
    faqs: [
      { question: "Does lower-barrier mean every part of the destination is accessible?", answer: "No. It means the curated destination has one or more access-friendly options. Natural surfaces, beaches, trails, facilities, and seasonal conditions still vary." },
      { question: "Can the planner guarantee ADA access?", answer: "No. It is not an accessibility certification. Use the access note, official accessibility information, and direct contact when a feature is essential." },
      { question: "Why can weather change accessibility?", answer: "Snow, ice, sand, flooding, heat, smoke, construction, and water levels can affect parking, surfaces, equipment, comfort, and facility availability." },
    ],
  },
];

export const guidesBySlug = new Map(guides.map((guide) => [guide.slug, guide]));

export const featuredGuideSlugs = [
  "outdoors-today",
  "family-day-trips",
  "beach-day-trips",
  "freighter-watching",
  "dark-sky-stargazing",
  "lower-barrier-outdoors",
];
