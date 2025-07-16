let baseUrl = "";
let refreshInterval = 15 * 1000; //default 15 seconds

//video effects
let grayscale = 0;
let sepia = 0;
let saturate = 1;
let hue = 0;
let brightness = 1;
let invert = 0;

//custom background
let customBackground = null;

const xmbvideo = document.getElementById("xmb-bg");

//statistics divs
const container = document.getElementsByClassName('stats-container')[0];
const c = document.getElementsByClassName('c')[0];
const r = document.getElementsByClassName('r')[0];
const mem = document.getElementsByClassName('mem')[0];
const hdd = document.getElementsByClassName('hdd')[0];
const fan = document.getElementsByClassName('fan')[0];
const uptime = document.getElementsByClassName('uptime')[0];
const syscalls = document.getElementsByClassName('syscalls')[0];

// get wallpaper engine api properties
window.wallpaperPropertyListener = {
  applyUserProperties: function (properties) {
    if (properties.grayscale && properties.grayscale.value) {
        grayscale = properties.grayscale.value;
    }
    if (properties.sepia && properties.sepia.value) {
        sepia = properties.sepia.value;
    }
    if (properties.saturation && properties.saturation.value) {
        saturate = properties.saturation.value;
    }
    if (properties.hue && properties.hue.value) {
        hue = properties.hue.value;
    }
    if (properties.brightness && properties.brightness.value) {
        brightness = properties.brightness.value;
    }
    if (properties.invertcolors) {
        invert = properties.invertcolors.value == true ? 1 : 0;
    }
    applyFilters();

    if(properties.custombackground) {
      customBackground = properties.custombackground.value;
      applyCustomBackground();
    }

    if (properties.ps3ip && properties.ps3ip.value) {
      //require ip only
      baseUrl = 'http://' + properties.ps3ip.value + '/cpursx.ps3?/sman.ps3';
    }
    if (properties.refreshinterval && properties.refreshinterval.value) {
      refreshInterval = properties.refreshinterval.value * 1000;
    }
    initMonitoring();
  }
};

function applyCustomBackground() {
  function isVideo(url) {
    return /\.(mp4|webm|ogg)$/i.test(url);
  }

  function isImage(url) {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  }

  if (!customBackground || typeof customBackground !== 'string' || !customBackground.trim()) {
    xmbvideo.src = "img/xmb_looped.webm"
    console.error('invalid url');
    return;
  }

  if (isVideo(customBackground)) {
    xmbvideo.poster = '';
    xmbvideo.src = customBackground;
  } else if (isImage(customBackground)) {
    xmbvideo.poster = customBackground;
    xmbvideo.src = '';
  } else {
    console.error('unsupported file type');
    xmbvideo.src = "img/xmb_looped.webm"
  }
  return;
}

function applyFilters() {
  //inverted colors, invert stats container text color
  if(invert == 1) {
    container.style.color = '#000'
  } else {
    container.style.color = '#fff'
  }
  
  xmbvideo.style.filter = `
    grayscale(${grayscale}) 
    sepia(${sepia}) 
    saturate(${saturate}) 
    hue-rotate(${hue}deg) 
    brightness(${brightness}) 
    invert(${invert})
  `.trim();
}

//blank all .innerhtmls and display error in c
function setError(message) {
  c.innerHTML = message;
  r.innerHTML = mem.innerHTML = hdd.innerHTML = fan.innerHTML = syscalls.innerHTML = uptime.innerHTML = '';
}

async function scrape(baseUrl) {

  if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
    console.error('Invalid baseUrl');
    return null;
  }

  // <a class='s' href='x'>
  const hrefList = [
    '/cpursx.ps3?up',
    '/cpursx.ps3?dn',
    '/browser.ps3$slaunch',
    '/games.ps3',
    '/dev_hdd0',
    '/cpursx.ps3?mode',
    '/dev_hdd0/xmlhost/game_plugin/cpursx.html'
  ];

  try {

  const fetchTimeout = Math.min(refreshInterval - 1000, 10000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeout); 

  const response = await fetch(baseUrl, { signal: controller.signal });
  clearTimeout(timeout);
  if (!response.ok) {
    throw new Error(`http error: ${response.status}`);
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const results = {};

  // syscalls check
  const h1List = doc.querySelectorAll('h1');
  results.syscallsDisabled = Array.from(h1List).some(
    h1 => h1.textContent.trim().toLowerCase().includes('cfw syscalls already disabled')
  );

  for (const href of hrefList) {
    // skip those we already have values for
    if (
      (href === '/cpursx.ps3?up' && results.cpuC != null) ||
      (href === '/cpursx.ps3?dn' && results.cpuF != null) ||
      (href === '/browser.ps3$slaunch' && results.memKB != null) ||
      (href === '/games.ps3' && results.memKB != null) ||
      (href === '/dev_hdd0' && results.hddGBFree != null) ||
      (href === '/cpursx.ps3?mode' && results.fanSpeedPercent != null) ||
      (href === '/dev_hdd0/xmlhost/game_plugin/cpursx.html' && results.uptime != null)
    ) {
      continue;
    }

    const link = doc.querySelector(`a[href="${href}"], a.s[href="${href}"]`);
    const text = link?.innerHTML?.replace(/<br\s*\/?>/gi, '\n') ?? null;

    if (!text) {
      results[href] = null;
      continue;
    }

    
    //cpu/rsx celcius
    switch (true) {
      case href === '/cpursx.ps3?up': {
        const cpu = text.match(/CPU:\s*(\d+)°C\s*\(MAX:\s*(\d+)°C\)/);
        const rsx = text.match(/RSX:\s*(\d+)°C/);
        if (cpu) {
          results.cpuC = parseInt(cpu[1], 10);
          results.maxCpuC = parseInt(cpu[2], 10);
        }
        if (rsx) results.rsxC = parseInt(rsx[1], 10);
        break;
      }
      //cpu/rsx fahrenheit
      case href === '/cpursx.ps3?dn': {
        const cpu = text.match(/CPU:\s*(\d+)°F\s*\(MAX:\s*(\d+)°F\)/);
        const rsx = text.match(/RSX:\s*(\d+)°F/);
        if (cpu) {
          results.cpuF = parseInt(cpu[1], 10);
          results.maxCpuF = parseInt(cpu[2], 10);
        }
        if (rsx) results.rsxF = parseInt(rsx[1], 10);
        break;
      }
      //free memory - in game and at xmb
      case href === '/browser.ps3$slaunch':
      case href === '/games.ps3': {
        const mem = text.match(/MEM:\s*([\d,]+)\s*KB/);
        if (mem) results.memKB = parseInt(mem[1].replace(/,/g, ''), 10);
        break;
      }
      //free space on hdd0
      case href === '/dev_hdd0': {
        const hdd = text.match(/HDD:\s*([\d.]+)\s*GB/);
        if (hdd) results.hddGBFree = parseFloat(hdd[1]);
        break;
      }
      //fanspeed
      case href === '/cpursx.ps3?mode': {
        const fan = text.match(/FAN SPEED:\s*(\d+)%/);
        if (fan) results.fanSpeedPercent = parseInt(fan[1], 10);
        break;
      }
      //uptime
      case href === '/dev_hdd0/xmlhost/game_plugin/cpursx.html': {
        const uptime = text.match(/\b\d{2}:\d{2}:\d{2}\b/);
        if (uptime) results.uptime = uptime[0];
        break;
      }

      default:
        results[href] = text;
    }
  }

  return results;

} catch (error) {
  if (error.name === 'AbortError') {
    console.error('fetch timed out');
  } else {
    console.error('fetch/parse failed', error);
  }
  return null;
}
}

let lock = false;

function initMonitoring() {
  if(lock) return;
  lock = true;

  console.log("monitoring started");

  async function fetch() {
    try {
      const systemStats = await scrape(baseUrl);

      //scrape failed
      if (!systemStats) {
        throw new Error('scrape returned null');
      }

      console.log(systemStats);
      // console.log(new Date().toLocaleTimeString());
      // console.log(systemStats);

      c.innerHTML = `CELL: ${systemStats.cpuC ?? 0}°C (${systemStats.cpuF ?? 0}°F)`;
      r.innerHTML = `RSX: ${systemStats.rsxC ?? 0}°C (${systemStats.rsxF ?? 0}°F)`;
      mem.innerHTML = `MEM: ${systemStats.memKB ?? "0000"}KB FREE`;
      hdd.innerHTML = `HDD: ${systemStats.hddGBFree ?? "0"}GB FREE`;
      fan.innerHTML = `FAN: ${systemStats.fanSpeedPercent ?? 0}%`;
      uptime.innerHTML = `UPTIME: ${systemStats.uptime ?? "00:00:00"}`;
      syscalls.innerHTML = systemStats.syscallsDisabled ? 'SYSCALLS DISABLED' : '';

    } catch (error) {
      console.error('fetch error:', error);
      //blank innerhtmls
      setError(`${error}`)
    } finally {
      setTimeout(fetch, refreshInterval);
    }
  }
  fetch();
}