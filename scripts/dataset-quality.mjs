// Fetches Conversions API data quality metrics for the Meta Pixel.
// Docs: https://developers.facebook.com/documentation/ads-commerce/conversions-api/dataset-quality-api
//
// Usage:
//   META_ACCESS_TOKEN=xxxx node scripts/dataset-quality.mjs
//   META_ACCESS_TOKEN=xxxx DATASET_ID=123 node scripts/dataset-quality.mjs

const DATASET_ID = process.env.DATASET_ID || "821997303593699";
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const API_VERSION = "v25.0";

if (!ACCESS_TOKEN) {
	console.error("Missing META_ACCESS_TOKEN environment variable.");
	console.error("Set it to a system user access token with ads_read + business_management permissions on this pixel.");
	process.exit(1);
}

const url = new URL(`https://graph.facebook.com/${API_VERSION}/dataset_quality`);
url.searchParams.set("dataset_id", DATASET_ID);
url.searchParams.set("access_token", ACCESS_TOKEN);

const response = await fetch(url);
const body = await response.json();

if (!response.ok) {
	console.error(`Request failed (${response.status}):`);
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
