const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Get CPU usage percentage
 */
function getCPUUsage() {
  return new Promise((resolve) => {
    const startMeasure = cpuAverage();
    
    setTimeout(() => {
      const endMeasure = cpuAverage();
      const idleDifference = endMeasure.idle - startMeasure.idle;
      const totalDifference = endMeasure.total - startMeasure.total;
      const percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
      resolve(percentageCPU);
    }, 100);
  });
}

function cpuAverage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  return {
    idle: totalIdle / cpus.length,
    total: totalTick / cpus.length,
  };
}

/**
 * Get memory usage
 */
function getMemoryUsage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  return {
    total: totalMemory,
    used: usedMemory,
    free: freeMemory,
    usagePercent: Math.round((usedMemory / totalMemory) * 100),
    totalGB: (totalMemory / (1024 ** 3)).toFixed(2),
    usedGB: (usedMemory / (1024 ** 3)).toFixed(2),
    freeGB: (freeMemory / (1024 ** 3)).toFixed(2),
  };
}

/**
 * Get disk usage (Windows)
 */
async function getDiskUsageWindows() {
  try {
    const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
    const lines = stdout.trim().split('\n').slice(1); // Skip header
    
    let totalSize = 0;
    let totalFree = 0;
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3 && parts[0].includes(':')) {
        const free = parseInt(parts[1]) || 0;
        const size = parseInt(parts[2]) || 0;
        totalSize += size;
        totalFree += free;
      }
    });
    
    const totalUsed = totalSize - totalFree;
    
    return {
      total: totalSize,
      used: totalUsed,
      free: totalFree,
      usagePercent: totalSize > 0 ? Math.round((totalUsed / totalSize) * 100) : 0,
      totalGB: (totalSize / (1024 ** 3)).toFixed(2),
      usedGB: (totalUsed / (1024 ** 3)).toFixed(2),
      freeGB: (totalFree / (1024 ** 3)).toFixed(2),
    };
  } catch (error) {
    return {
      total: 0,
      used: 0,
      free: 0,
      usagePercent: 0,
      totalGB: '0',
      usedGB: '0',
      freeGB: '0',
      error: 'Unable to fetch disk usage',
    };
  }
}

/**
 * Get disk usage (Linux/Mac)
 */
async function getDiskUsageUnix() {
  try {
    const { stdout } = await execAsync('df -k /');
    const lines = stdout.trim().split('\n');
    const data = lines[1].trim().split(/\s+/);
    
    const total = parseInt(data[1]) * 1024; // Convert KB to bytes
    const used = parseInt(data[2]) * 1024;
    const free = parseInt(data[3]) * 1024;
    
    return {
      total,
      used,
      free,
      usagePercent: Math.round((used / total) * 100),
      totalGB: (total / (1024 ** 3)).toFixed(2),
      usedGB: (used / (1024 ** 3)).toFixed(2),
      freeGB: (free / (1024 ** 3)).toFixed(2),
    };
  } catch (error) {
    return {
      total: 0,
      used: 0,
      free: 0,
      usagePercent: 0,
      totalGB: '0',
      usedGB: '0',
      freeGB: '0',
      error: 'Unable to fetch disk usage',
    };
  }
}

/**
 * Get disk usage based on platform
 */
async function getDiskUsage() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    return await getDiskUsageWindows();
  } else {
    return await getDiskUsageUnix();
  }
}

/**
 * Get network speed (simplified - shows network interfaces)
 */
function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const activeInterfaces = [];
  
  for (const name in interfaces) {
    const iface = interfaces[name];
    const ipv4 = iface.find(i => i.family === 'IPv4' && !i.internal);
    if (ipv4) {
      activeInterfaces.push({
        name,
        address: ipv4.address,
        mac: ipv4.mac,
      });
    }
  }
  
  return {
    interfaces: activeInterfaces,
    hostname: os.hostname(),
  };
}

/**
 * Get all system stats
 */
async function getSystemStats() {
  try {
    const [cpuUsage, memoryUsage, diskUsage] = await Promise.all([
      getCPUUsage(),
      Promise.resolve(getMemoryUsage()),
      getDiskUsage(),
    ]);
    
    const networkInfo = getNetworkInfo();
    
    return {
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
      },
      memory: memoryUsage,
      disk: diskUsage,
      network: networkInfo,
      uptime: os.uptime(),
      platform: os.platform(),
      hostname: os.hostname(),
    };
  } catch (error) {
    console.error('Error getting system stats:', error);
    return {
      cpu: { usage: 0, cores: 0, model: 'Unknown' },
      memory: { usagePercent: 0, totalGB: '0', usedGB: '0', freeGB: '0' },
      disk: { usagePercent: 0, totalGB: '0', usedGB: '0', freeGB: '0' },
      network: { interfaces: [], hostname: os.hostname() },
      uptime: 0,
      platform: os.platform(),
      hostname: os.hostname(),
      error: 'Unable to fetch system stats',
    };
  }
}

/**
 * Format uptime to human readable
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

module.exports = {
  getSystemStats,
  getCPUUsage,
  getMemoryUsage,
  getDiskUsage,
  getNetworkInfo,
  formatUptime,
};
