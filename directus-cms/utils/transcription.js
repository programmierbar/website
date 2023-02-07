const axios = require('axios').default;

async function create(title, url, env, logger) {
  const payload = {
    transcription: {
      name: title,
      language: 'de-DE',
      tmp_url: url,
      folder: 'programmierbar/episodes',
      is_subtitle: false,
      organization_id: '491',
      use_vocabulary: true,
    },
  };
  // Create or update podcast episode at Buzzsprout
  const response = await sendToHappyScribe(
    'POST',
    'transcriptions',
    payload,
    env
  );

  return response.data.id;
}

async function isDone(id, env) {
  const response = await sendToHappyScribe(
    'GET',
    `transcriptions/${id}`,
    null,
    env
  );

  return response.data.state === 'automatic_done';
}

async function createExport(id, env) {
  const payload = {
    export: {
      format: 'txt',
      transcription_ids: [id],
    },
  };
  const response = await sendToHappyScribe('POST', `exports`, payload, env);

  return response.data.id;
}

async function getExportUrl(id, env) {
  const response = await sendToHappyScribe('GET', `exports/${id}`, null, env);

  if (['expired', 'failed'].includes(response.data.state)) {
    throw new Error(`Export failed with the status "${response.data.state}".`);
  }

  const { download_link } = response.data;

  if (!download_link) return null;

  const transcriptResponse = await axios({ url: download_link, method: 'GET' });

  return transcriptResponse.data;
}

async function sendToHappyScribe(method, path, payload, env) {
  const config = {
    method,
    url: `${env.HAPPYSCRIBE_API_URL}${path}`,
    headers: {
      Authorization: `Bearer ${env.HAPPYSCRIBE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (payload) {
    config.data = JSON.stringify(payload);
  }
  const response = await axios(config);

  // Throw error if the request was not successful
  if (response.status !== 200 && response.status !== 201) {
    throw new Error(
      `HappyScribe replied with the status "${response.status}" and the text "${response.statusText}".`
    );
  }
  return response;
}
module.exports = { create, isDone, createExport, getExportUrl };
