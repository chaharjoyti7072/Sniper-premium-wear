const { put, get } = require("@vercel/blob");

const STORE_OPTIONS = {
  access: "private"
};

async function getJSON(key, fallback) {
  try {
    const result = await get(key, {
      access: "private",
      useCache: false
    });

    if (!result) return fallback;

    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

async function putJSON(key, value) {
  await put(
    key,
    JSON.stringify(value),
    {
      ...STORE_OPTIONS,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json"
    }
  );
}

module.exports = {
  getJSON,
  putJSON
};
