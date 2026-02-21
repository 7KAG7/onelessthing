export const weatherFragmentShader = `
precision highp float;

varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_loop_seconds;
uniform int u_variant;

const float TAU = 6.28318530718;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash21(i + vec2(0.0, 0.0));
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i += 1) {
    value += amp * noise(p);
    p = p * 2.02 + vec2(31.7, 18.3);
    amp *= 0.5;
  }
  return value;
}

float periodicDistance(float a, float b) {
  float d = abs(a - b);
  return min(d, 1.0 - d);
}

float cloudLayer(vec2 uv, float t, float scale, float amplitude, float softness, float phase, float speed) {
  vec2 drift = vec2(cos(TAU * (t + phase)), sin(TAU * (t + phase))) * speed;
  vec2 p = uv * scale + drift;
  float n = fbm(p);
  return smoothstep(amplitude - softness, amplitude + softness, n);
}

float rainField(vec2 uv, float t, float density, float speed, float blur) {
  vec2 p = uv;
  p.x *= mix(8.0, 18.0, density);
  float lane = floor(p.x);
  float rnd = hash11(lane * 1.173 + 0.13);
  float xJitter = (rnd - 0.5) * 0.22;
  float y = fract(p.y * 1.7 + t * speed + rnd * 5.0);
  float streak = smoothstep(0.0, blur, y) * (1.0 - smoothstep(0.11, 0.11 + blur, y));
  float mask = 1.0 - smoothstep(0.22, 0.5, abs(fract(p.x + xJitter) - 0.5));
  return streak * mask;
}

float snowField(vec2 uv, float t, float size, float speed, float seedShift) {
  vec2 p = uv * vec2(8.0, 6.0);
  vec2 id = floor(p);
  vec2 f = fract(p) - 0.5;

  float rnd = hash21(id + seedShift);
  vec2 sway = vec2(
    sin(TAU * (t + rnd)) * 0.18,
    fract(t * speed + rnd) - 0.5
  );

  float d = length((f - sway) * vec2(1.2, 1.0));
  return smoothstep(size, size - 0.025, d);
}

float starTwinkle(vec2 uv, float t, vec2 center, float radius, float phase, float speed) {
  float d = distance(uv, center);
  float tw = 0.65 + 0.35 * sin(TAU * (t * speed + phase));
  return smoothstep(radius, radius * 0.35, d) * tw;
}

vec3 applySoftBloom(vec3 color, float intensity, vec2 uv, vec2 center) {
  float d = distance(uv, center);
  float bloom = exp(-d * 7.5) * intensity;
  return color + bloom;
}

void main() {
  float loopTime = mod(u_time, u_loop_seconds);
  float t = loopTime / u_loop_seconds;

  vec2 uv = v_uv;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / max(u_resolution.y, 1.0);

  vec3 bgTop;
  vec3 bgBottom;
  vec3 color;
  float haze = 0.0;

  // Variant IDs
  bool isClearDay = u_variant == 0;
  bool isClearNight = u_variant == 1;
  bool isPartlyDay = u_variant == 2;
  bool isPartlyNight = u_variant == 3;
  bool isOvercast = u_variant == 4;
  bool isRainLight = u_variant == 5;
  bool isRainHeavy = u_variant == 6;
  bool isStorm = u_variant == 7;
  bool isSnow = u_variant == 8;
  bool isFog = u_variant == 9;
  bool isWindy = u_variant == 10;

  if (isClearDay) {
    bgTop = vec3(0.58, 0.73, 0.90);
    bgBottom = vec3(0.80, 0.90, 0.98);
  } else if (isClearNight) {
    bgTop = vec3(0.05, 0.08, 0.16);
    bgBottom = vec3(0.10, 0.13, 0.24);
  } else if (isPartlyDay) {
    bgTop = vec3(0.55, 0.69, 0.86);
    bgBottom = vec3(0.77, 0.88, 0.97);
  } else if (isPartlyNight) {
    bgTop = vec3(0.08, 0.10, 0.18);
    bgBottom = vec3(0.13, 0.16, 0.25);
  } else if (isOvercast) {
    bgTop = vec3(0.48, 0.54, 0.60);
    bgBottom = vec3(0.66, 0.70, 0.76);
  } else if (isRainLight) {
    bgTop = vec3(0.42, 0.49, 0.58);
    bgBottom = vec3(0.58, 0.64, 0.72);
  } else if (isRainHeavy) {
    bgTop = vec3(0.30, 0.36, 0.45);
    bgBottom = vec3(0.45, 0.51, 0.60);
  } else if (isStorm) {
    bgTop = vec3(0.15, 0.18, 0.24);
    bgBottom = vec3(0.26, 0.30, 0.38);
  } else if (isSnow) {
    bgTop = vec3(0.66, 0.74, 0.82);
    bgBottom = vec3(0.84, 0.90, 0.95);
  } else if (isFog) {
    bgTop = vec3(0.62, 0.66, 0.72);
    bgBottom = vec3(0.76, 0.80, 0.85);
  } else {
    bgTop = vec3(0.52, 0.63, 0.75);
    bgBottom = vec3(0.73, 0.83, 0.92);
  }

  color = mix(bgBottom, bgTop, smoothstep(-0.2, 1.0, uv.y));

  // Volumetric-style cloud layering.
  float c1 = cloudLayer(uv, t, 2.0, 0.50, 0.16, 0.03, isWindy ? 0.12 : 0.07);
  float c2 = cloudLayer(uv + vec2(0.08, 0.03), t, 3.3, 0.56, 0.18, 0.27, isWindy ? 0.18 : 0.09);
  float cDense = cloudLayer(uv + vec2(-0.04, 0.02), t, 4.2, 0.58, 0.14, 0.51, 0.06);

  float cloudMix = 0.0;
  vec3 cloudTint = vec3(0.93, 0.95, 0.98);

  if (isClearDay) {
    cloudMix = c1 * 0.16;
    color = applySoftBloom(color, 0.08, uv, vec2(0.72, 0.78));
  }

  if (isClearNight) {
    cloudMix = c1 * 0.10;
    float moonPulse = 0.97 + 0.03 * sin(TAU * t);
    float moon = exp(-distance(uv, vec2(0.78, 0.80)) * 10.0) * moonPulse;
    color += vec3(0.22, 0.25, 0.34) * moon;

    float stars = 0.0;
    stars += starTwinkle(uv, t, vec2(0.18, 0.84), 0.018, 0.1, 1.0);
    stars += starTwinkle(uv, t, vec2(0.32, 0.73), 0.015, 0.7, 2.0);
    stars += starTwinkle(uv, t, vec2(0.52, 0.86), 0.017, 0.4, 1.0);
    stars += starTwinkle(uv, t, vec2(0.70, 0.70), 0.014, 0.9, 2.0);
    stars += starTwinkle(uv, t, vec2(0.84, 0.88), 0.016, 0.2, 1.0);
    color += vec3(0.36, 0.42, 0.55) * stars * 0.45;
  }

  if (isPartlyDay || isPartlyNight) {
    cloudMix = c1 * 0.30 + c2 * 0.24;
  }

  if (isOvercast) {
    cloudMix = c1 * 0.38 + c2 * 0.32 + cDense * 0.24;
    float pulse = 0.99 + 0.01 * sin(TAU * t);
    color *= pulse;
    cloudTint = vec3(0.84, 0.87, 0.91);
  }

  if (isRainLight || isRainHeavy || isStorm) {
    cloudMix = c1 * 0.34 + c2 * 0.30 + cDense * 0.26;
    cloudTint = vec3(0.78, 0.82, 0.88);
  }

  if (isSnow) {
    cloudMix = c1 * 0.23 + c2 * 0.18;
    cloudTint = vec3(0.90, 0.93, 0.96);
  }

  if (isFog) {
    cloudMix = c1 * 0.15;
    cloudTint = vec3(0.92, 0.94, 0.96);
  }

  if (isWindy) {
    cloudMix = c1 * 0.28 + c2 * 0.24;
  }

  color = mix(color, cloudTint, clamp(cloudMix, 0.0, 0.75));

  if (isRainLight || isRainHeavy || isStorm) {
    float rain = rainField(uv, t, isRainHeavy || isStorm ? 0.78 : 0.40, isRainHeavy || isStorm ? 4.0 : 3.0, 0.05);
    float rainAlpha = isRainHeavy || isStorm ? 0.20 : 0.12;
    color = mix(color, vec3(0.82, 0.88, 0.95), rain * rainAlpha);
  }

  if (isStorm) {
    // Internal cloud lightning glow (no visible bolts), randomized but loop-seamless.
    float glow = 0.0;
    for (int i = 0; i < 4; i += 1) {
      float seed = float(i) * 7.91 + 1.3;
      float center = 0.06 + hash11(seed) * 0.88;
      float amp = 0.04 + hash11(seed + 2.1) * 0.06;
      float width = 0.020 + hash11(seed + 4.3) * 0.020;
      float d = periodicDistance(t, center);
      glow += amp * exp(-(d * d) / (width * width));
    }

    float cloudMask = clamp(c2 + cDense, 0.0, 1.0);
    color += vec3(0.20, 0.24, 0.32) * glow * cloudMask;
  }

  if (isSnow) {
    float backSnow = snowField(uv + vec2(0.0, 0.08), t, 0.07, 1.0, 2.4);
    float frontSnow = snowField(uv, t, 0.09, 2.0, 9.7);
    color = mix(color, vec3(0.97, 0.98, 1.0), backSnow * 0.16 + frontSnow * 0.24);
  }

  if (isFog) {
    float f1 = fbm(uv * 3.0 + vec2(cos(TAU * t), sin(TAU * t)) * 0.2);
    float f2 = fbm(uv * 4.6 + vec2(cos(TAU * (t + 0.23)), sin(TAU * (t + 0.23))) * 0.16);
    haze = smoothstep(0.38, 0.75, f1 * 0.65 + f2 * 0.35);
    float pulse = 0.985 + 0.015 * sin(TAU * t);
    color = mix(color, vec3(0.91, 0.93, 0.95), haze * 0.36) * pulse;
  }

  if (isWindy) {
    float windBand = smoothstep(0.35, 0.75, fbm(uv * 6.0 + vec2(cos(TAU * t), 0.0) * 0.8));
    color += vec3(0.03, 0.05, 0.07) * windBand * 0.06;
  }

  // Gentle global cinematic desaturation for readability.
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, 0.86);
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`
