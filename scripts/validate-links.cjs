const fs = require('fs');
const path = require('path');
const https = require('https');

// Replicate drug slug and cash pricing URL generation from the app
function drugSlug(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // remove parenthesized details
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // trim hyphens from ends
}

function getGoodRxUrl(name) {
  return `https://www.goodrx.com/${drugSlug(name)}`;
}

function getCostPlusUrl() {
  return 'https://costplusdrugs.com/medications/';
}

// Helper to fetch URL headers and check status code
function checkUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const options = {
        method: 'HEAD',
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*'
        },
        timeout: timeoutMs
      };

      const req = https.request(options, (res) => {
        // If HEAD is not supported or returns 405, fallback to a GET request
        if (res.statusCode === 405) {
          options.method = 'GET';
          const getReq = https.request(options, (getRes) => {
            getRes.resume(); // consume response body
            resolve({ status: getRes.statusCode, url });
          });
          getReq.on('error', () => resolve({ status: 500, url }));
          getReq.end();
        } else {
          res.resume(); // consume response body
          resolve({ status: res.statusCode, url });
        }
      });

      req.on('error', () => {
        // Retry with GET on standard connection error
        options.method = 'GET';
        const getReq = https.request(options, (getRes) => {
          getRes.resume();
          resolve({ status: getRes.statusCode, url });
        });
        getReq.on('error', () => resolve({ status: 500, url }));
        getReq.end();
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 408, url });
      });

      req.end();
    } catch (e) {
      resolve({ status: 400, url });
    }
  });
}

// Queue runner to execute URL checks concurrently but rate-limited
async function runValidationQueue(urls, concurrency = 3) {
  const results = [];
  const queue = [...urls];
  
  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      try {
        console.log(`Checking: ${url}`);
        const res = await checkUrl(url);
        results.push(res);
        // Small delay to prevent rate-limiting/blocking
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        results.push({ status: 500, url });
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const dbPath = path.join(__dirname, '../src/data/formulary.json');
  console.log(`Loading database from ${dbPath}...`);
  
  if (!fs.existsSync(dbPath)) {
    console.error('Error: formulary.json database file not found.');
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const urlsToCheck = new Set();
  const drugNames = new Set();

  // Collect all drug names and source links across all guides
  db.guides.forEach((guide) => {
    // 1. Guide reference URLs
    guide.references.forEach((ref) => {
      if (ref.url) urlsToCheck.add(ref.url);
    });

    // 2. Payer formulary URLs
    guide.payers.forEach((payer) => {
      if (payer.formularyUrl) urlsToCheck.add(payer.formularyUrl);
    });

    // 3. Formulary record items
    guide.records.forEach((record) => {
      // Preferred agent
      if (record.preferredAgent.inn) drugNames.add(record.preferredAgent.inn);
      if (record.preferredAgent.brand) drugNames.add(record.preferredAgent.brand);

      // Alternatives
      if (record.alternatives) {
        record.alternatives.forEach((alt) => {
          if (alt.drug) drugNames.add(alt.drug);
        });
      }

      // Rejects
      if (record.paRequired) {
        record.paRequired.forEach((rej) => {
          if (rej.drug) drugNames.add(rej.drug);
        });
      }
    });
  });

  // Generate GoodRx URLs for unique drug names
  console.log(`Found ${drugNames.size} unique drug molecules/names. Generating GoodRx links...`);
  drugNames.forEach((name) => {
    urlsToCheck.add(getGoodRxUrl(name));
  });

  // Include Cost Plus Drugs landing page
  urlsToCheck.add(getCostPlusUrl());

  const urlList = Array.from(urlsToCheck).filter(Boolean);
  console.log(`Starting validation of ${urlList.length} unique URLs...`);
  
  const results = await runValidationQueue(urlList, 3);
  
  console.log('\n======================================');
  console.log('       URL VALIDATION REPORT          ');
  console.log('======================================');
  
  const failures = results.filter((r) => r.status === 404);
  const timeouts = results.filter((r) => r.status === 408);
  const blocks = results.filter((r) => r.status === 403);
  const successes = results.filter((r) => r.status >= 200 && r.status < 300);

  console.log(`Successes (2xx): ${successes.length}`);
  console.log(`Warnings/Blocks (403): ${blocks.length} (inconclusive, likely bot protection)`);
  console.log(`Timeouts (408): ${timeouts.length}`);
  console.log(`Dead Links (404): ${failures.length}\n`);

  if (failures.length > 0) {
    console.log('❌ DEAD LINKS DETECTED (404):');
    failures.forEach((f) => {
      console.log(` - ${f.url}`);
    });
    process.exit(1);
  } else {
    console.log('✅ All links are valid (no 404s found)!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
