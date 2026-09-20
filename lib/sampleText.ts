/**
 * Pre-loaded sample so a first-time user can click "Run Judgment" immediately.
 * It's deliberately hedgy, em-dash-heavy, and a bit padded.
 */
export const SAMPLE_TEXT = `I think we should probably consider moving the launch to next quarter — at least, that's sort of my current read on things. The data — which, to be fair, is still a little incomplete — seems to suggest that onboarding conversion might be somewhat lower than we'd perhaps hoped. At the end of the day, it is important to note that this decision was made by the team collectively, and mistakes were made on all sides. It's worth mentioning that we could maybe revisit the pricing page too — though I'm not totally sure that's the main issue. Anyway, let me know what you think and we can perhaps figure out next steps at some point.`;

export const WRITING_EXAMPLES = [
  { id: "hedged", title: "Hedged launch note", description: "Spot qualification, filler, and passive voice.", text: SAMPLE_TEXT },
  { id: "clear", title: "Clear update", description: "Compare a direct decision and concrete next steps.", text: "We will move the launch to October 15. Onboarding conversion fell from 42% to 31% in the latest test. Maya will revise the first-run flow by Friday, and the team will review conversion again next Wednesday. If the rate stays below 35%, we will delay the public announcement." },
  { id: "vague", title: "Vague next steps", description: "Look for unclear ownership and actionability.", text: "We should probably improve the onboarding experience soon. There are a few things that may need attention, and it might be worth discussing them with the team. Some changes could be made at some point, but the details are still being worked out. Let me know if anyone has thoughts." },
] as const;
