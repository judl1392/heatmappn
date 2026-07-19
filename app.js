const state = {
  rows: [],
  headers: [],
  geo: null,
  layer: null,
  noDataLayer: null,
  values: new Map(),
  unmatched: [],
  breaks: [],
  importDetail: null,
  columnConfidenceLow: false,
  valueLabelEdited: false,
  mapGenerated: false,
  pinnedPostcode: null,
  palette: [],
  scaleMode: "quantile",
  scaleMin: 0,
  scaleMax: 0,
  scaleCentre: 0,
  legendPosition: "bottom-right",
  validation: { invalidRows: [], unmatchedRows: [] },
};
const $ = (id) => document.getElementById(id);
const paletteDefinitions = {
  blue: ["#eff6ff", "#3b82f6", "#172554"],
  green: ["#edf3ee", "#66967d", "#163e32"],
  purple: ["#f5f3ff", "#8b5cf6", "#3b0764"],
  orange: ["#fff7ed", "#f97316", "#7c2d12"],
  red: ["#fef2f2", "#ef4444", "#7f1d1d"],
  "blue-red": ["#2166ac", "#f7f7f7", "#b2182b"],
  colourblind: ["#0072b2", "#f7f7f7", "#d55e00"],
};
const map = L.map("map", {
  zoomControl: true,
  attributionControl: true,
  preferCanvas: false,
}).setView([-27, 134], 4);
const lightMap = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  {
    maxZoom: 20,
    crossOrigin: true,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
).addTo(map);
const streetMap = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    crossOrigin: true,
    attribution: "&copy; OpenStreetMap contributors",
  },
);
const noBasemap = L.layerGroup();
const basemaps = { light: lightMap, streets: streetMap, none: noBasemap };
let basemapTileError = false;
[lightMap, streetMap].forEach((layer) => {
  layer.on("loading", () => {
    basemapTileError = false;
    $("appearanceWarning").textContent = "";
  });
  layer.on("tileerror", () => {
    basemapTileError = true;
    $("appearanceWarning").textContent =
      "Some basemap tiles could not be loaded. They may also be missing from PNG exports.";
  });
});

function appearanceSettings() {
  return {
    fillOpacity: Number($("fillOpacity").value),
    boundaryOpacity: Number($("boundaryOpacity").value),
    boundaryWidth: Number($("boundaryWidth").value),
    borders: $("postcodeBorders").checked,
  };
}
function postcodeStyle(feature) {
  const appearance = appearanceSettings(),
    value = state.values.get(String(feature.properties.POA_CODE21));
  return {
    fillColor: colour(value),
    fillOpacity: appearance.fillOpacity,
    color: "#74827c",
    opacity: appearance.borders ? appearance.boundaryOpacity : 0,
    weight: appearance.borders ? appearance.boundaryWidth : 0,
  };
}
function noDataStyle() {
  const appearance = appearanceSettings();
  return {
    fillColor: "#dfe3e1",
    fillOpacity: Math.min(0.22, appearance.fillOpacity * 0.35),
    color: "#a3ada8",
    opacity: appearance.borders ? appearance.boundaryOpacity * 0.75 : 0,
    weight: appearance.borders
      ? Math.min(appearance.boundaryWidth, 0.5)
      : 0,
  };
}
function applyAppearance() {
  $("fillOpacityValue").textContent =
    `${Math.round(Number($("fillOpacity").value) * 100)}%`;
  $("boundaryOpacityValue").textContent =
    `${Math.round(Number($("boundaryOpacity").value) * 100)}%`;
  if (state.noDataLayer) state.noDataLayer.setStyle(noDataStyle());
  if (state.layer) state.layer.setStyle(postcodeStyle);
}
function selectBasemap() {
  Object.values(basemaps).forEach((layer) => map.removeLayer(layer));
  basemaps[$("basemapMode").value].addTo(map);
  basemapTileError = false;
  $("appearanceWarning").textContent = "";
}
["fillOpacity", "boundaryOpacity"].forEach((id) =>
  $(id).addEventListener("input", applyAppearance),
);
["boundaryWidth", "postcodeBorders"].forEach(
  (id) => ($(id).onchange = applyAppearance),
);
$("basemapMode").onchange = selectBasemap;

function setDisclosure(button, open) {
  const body = $(button.getAttribute("aria-controls"));
  button.setAttribute("aria-expanded", String(open));
  body.hidden = !open;
  button.closest(".workflow-section")?.classList.toggle("is-open", open);
}
document.querySelectorAll(".workflow-toggle").forEach((button) => {
  button.onclick = () =>
    setDisclosure(button, button.getAttribute("aria-expanded") !== "true");
});
function wireNestedDisclosure(buttonId) {
  const button = $(buttonId),
    body = $(button.getAttribute("aria-controls"));
  button.onclick = () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    body.hidden = !open;
  };
}
wireNestedDisclosure("previewToggle");
wireNestedDisclosure("unmatchedToggle");

function setAppearancePopover(open) {
  $("appearancePopover").classList.toggle("hidden", !open);
  $("appearanceButton").setAttribute("aria-expanded", String(open));
  if (open) $("basemapMode").focus();
}
$("appearanceButton").onclick = (event) => {
  event.stopPropagation();
  setAppearancePopover($("appearanceButton").getAttribute("aria-expanded") !== "true");
};
$("closeAppearance").onclick = () => {
  setAppearancePopover(false);
  $("appearanceButton").focus();
};
$("appearancePopover").onclick = (event) => event.stopPropagation();
document.addEventListener("click", () => setAppearancePopover(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("appearanceButton").getAttribute("aria-expanded") === "true") {
    setAppearancePopover(false);
    $("appearanceButton").focus();
  }
});

$("resetViewButton").onclick = () => {
  if (state.layer && state.layer.getBounds().isValid())
    map.fitBounds(state.layer.getBounds(), { padding: [12, 12], animate: false });
  else map.setView([-27, 134], 4, { animate: false });
};
function searchPostcode() {
  const postcode = cleanPostcode($("postcodeSearch").value);
  if (!postcode || !state.geo) {
    $("postcodeSearch").setCustomValidity("Enter a valid four-digit postcode.");
    $("postcodeSearch").reportValidity();
    return;
  }
  $("postcodeSearch").setCustomValidity("");
  const feature = state.geo.features.find(
    (item) => String(item.properties.POA_CODE21) === postcode,
  );
  if (!feature) {
    $("postcodeSearch").setCustomValidity("This postcode is not in the ABS geography.");
    $("postcodeSearch").reportValidity();
    return;
  }
  map.fitBounds(L.geoJSON(feature).getBounds(), {
    padding: [28, 28],
    maxZoom: 12,
    animate: false,
  });
  state.layer?.eachLayer((layer) => {
    if (String(layer.feature.properties.POA_CODE21) === postcode) {
      layer.openTooltip();
      state.pinnedPostcode = postcode;
      renderPinnedDetail();
    }
  });
}
$("searchPostcodeButton").onclick = searchPostcode;
$("postcodeSearch").onkeydown = (event) => {
  if (event.key === "Enter") searchPostcode();
};
new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(
  document.querySelector(".map-shell"),
);

fetch("data/australia-postal-areas.geojson")
  .then((r) => {
    if (!r.ok) throw new Error("Boundary file failed to load");
    return r.json();
  })
  .then((g) => {
    state.geo = g;
    if (state.rows.length) renderValidation();
  })
  .catch(() => {
    $("fileStatus").classList.remove("hidden");
    $("fileStatus").textContent =
      "The postcode boundaries could not be loaded. Please refresh and try again.";
  });

const dz = $("dropzone"),
  fi = $("fileInput");
dz.onclick = () => fi.click();
dz.onkeydown = (e) => {
  if (e.key === "Enter" || e.key === " ") fi.click();
};
["dragenter", "dragover"].forEach((x) =>
  dz.addEventListener(x, (e) => {
    e.preventDefault();
    dz.classList.add("drag");
  }),
);
["dragleave", "drop"].forEach((x) =>
  dz.addEventListener(x, (e) => {
    e.preventDefault();
    dz.classList.remove("drag");
  }),
);
dz.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));
fi.onchange = () => handleFile(fi.files[0]);

function handleFile(file) {
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "csv") {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (r) => {
        const parsed = normaliseParsedHeaders(r.data, r.meta.fields || []);
        loadRows(file.name, parsed.rows, parsed.headers);
      },
      error: (e) => alert(e.message),
    });
  } else if (["xlsx", "xls"].includes(ext)) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" }),
          detected = detectWorkbookTable(wb);
        if (!detected)
          throw new Error("No tabular rows found in the workbook.");
        loadRows(file.name, detected.rows, detected.headers, {
          sheetName: detected.sheetName,
          headerRow: detected.headerRow + 1,
        });
      } catch (err) {
        alert("Could not read workbook: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  } else alert("Please upload a CSV, XLSX or XLS file.");
}

const headerTerms = [
  "postcode",
  "post code",
  "poa",
  "postal area",
  "revenue",
  "sales",
  "value",
  "population",
  "person records",
];
function meaningfulHeader(v) {
  const s = String(v ?? "").trim();
  return s && !/^__EMPTY(?:_\d+)?$/i.test(s) && /[a-z]/i.test(s);
}
function dataCell(v) {
  if (v === null || v === undefined || String(v).trim() === "") return false;
  if (typeof v === "number") return true;
  const s = String(v).trim();
  return (
    /^\d{4}(?:\s*,\s*[A-Z]{2,3})?$/.test(s) ||
    Number.isFinite(Number(s.replace(/[$,%\s,]/g, "")))
  );
}
function detectWorkbookTable(wb) {
  let best = null;
  wb.SheetNames.forEach((sheetName, sheetIndex) => {
    const ws = wb.Sheets[sheetName],
      preview = XLSX.utils
        .sheet_to_json(ws, {
          header: 1,
          defval: "",
          raw: true,
          range: 0,
          blankrows: true,
        })
        .slice(0, 30);
    preview.forEach((row, rowIndex) => {
      const real = row.filter(meaningfulHeader),
        following = preview.slice(
          rowIndex + 1,
          Math.min(preview.length, rowIndex + 6),
        ),
        dataRows = following.filter((r) => r.some(dataCell)).length;
      if (!real.length || !dataRows) return;
      const termHits = real.reduce(
          (n, v) =>
            n +
            headerTerms.filter((t) => String(v).toLowerCase().includes(t))
              .length,
          0,
        ),
        populatedBelow = following.reduce(
          (n, r) => n + r.filter((v) => String(v ?? "").trim() !== "").length,
          0,
        ),
        score =
          termHits * 100 +
          dataRows * 10 +
          Math.min(populatedBelow, 20) -
          rowIndex * 0.01;
      const candidate = {
        ws,
        sheetName,
        sheetIndex,
        headerRow: rowIndex,
        score,
      };
      if (
        !best ||
        candidate.score > best.score ||
        (candidate.score === best.score && sheetIndex < best.sheetIndex)
      )
        best = candidate;
    });
  });
  return best ? parseDetectedTable(best) : null;
}
function parseDetectedTable(found) {
  const matrix = XLSX.utils.sheet_to_json(found.ws, {
    header: 1,
    defval: "",
    raw: false,
    range: found.headerRow,
    blankrows: false,
  });
  if (matrix.length < 2) return null;
  const sourceHeaders = matrix[0],
    data = matrix.slice(1),
    usedColumns = Math.max(
      sourceHeaders.length,
      ...data.map((r) =>
        r.reduce((last, v, i) => (String(v ?? "").trim() ? i + 1 : last), 0),
      ),
    ),
    realHeaderCount = sourceHeaders
      .slice(0, usedColumns)
      .filter(meaningfulHeader).length;
  const headers = [],
    seen = new Map();
  for (let i = 0; i < usedColumns; i++) {
    let name = meaningfulHeader(sourceHeaders[i])
      ? String(sourceHeaders[i]).trim()
      : "";
    const hasNumericData = data.some((r) => dataCell(r[i]));
    if (!name && realHeaderCount === 1 && hasNumericData) name = "Value";
    if (!name) name = `Column ${XLSX.utils.encode_col(i)}`;
    const count = (seen.get(name) || 0) + 1;
    seen.set(name, count);
    headers.push(count === 1 ? name : `${name} ${count}`);
  }
  const rows = data
    .filter((r) => r.some((v) => String(v ?? "").trim() !== ""))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
  return { ...found, headers, rows };
}

function normaliseParsedHeaders(rows, sourceHeaders) {
  const realCount = sourceHeaders.filter(meaningfulHeader).length,
    headers = [],
    seen = new Map();
  sourceHeaders.forEach((source, i) => {
    let name = meaningfulHeader(source) ? String(source).trim() : "";
    if (!name && realCount === 1 && rows.some((row) => dataCell(row[source])))
      name = "Value";
    if (!name) name = `Column ${String.fromCharCode(65 + i)}`;
    const count = (seen.get(name) || 0) + 1;
    seen.set(name, count);
    headers.push(count === 1 ? name : `${name} ${count}`);
  });
  return {
    headers,
    rows: rows.map((row) =>
      Object.fromEntries(
        headers.map((header, i) => [header, row[sourceHeaders[i]] ?? ""]),
      ),
    ),
  };
}

function loadRows(name, rows, headers, detail = null) {
  const populatedHeaders = headers.filter((header) =>
    rows.some((row) => !blank(row[header])),
  );
  if (!populatedHeaders.length) {
    alert("No populated columns were found in this file.");
    return;
  }
  state.rows = rows;
  state.headers = populatedHeaders;
  state.importDetail = detail;
  const excelDetail = detail
    ? `<br>Worksheet: ${escapeHtml(detail.sheetName)} · detected header row ${detail.headerRow}`
    : "";
  $("fileStatus").innerHTML =
    `<strong>${escapeHtml(name)}</strong><br>${rows.length.toLocaleString()} rows found${excelDetail}`;
  $("fileStatus").classList.remove("hidden");
  fillSelect($("postcodeColumn"), populatedHeaders, rows);
  fillSelect($("valueColumn"), populatedHeaders, rows);
  const suggestions = suggestColumns(rows, populatedHeaders);
  $("postcodeColumn").value = suggestions.postcode;
  $("valueColumn").value = suggestions.value;
  if (!state.valueLabelEdited) $("valueLabel").value = suggestions.value;
  state.columnConfidenceLow = suggestions.lowConfidence;
  $("mappingControls").classList.remove("hidden");
  document
    .querySelectorAll(".requires-data")
    .forEach((element) => element.classList.remove("hidden"));
  $("previewToggle").setAttribute("aria-expanded", "false");
  $("dataPreview").hidden = true;
  recommendScale();
  renderPreview();
  renderValidation();
  updatePresentation();
}
function fillSelect(sel, headers, rows) {
  sel.innerHTML = headers
    .map((header) => {
      const sample = rows.find((row) => !blank(row[header]))?.[header],
        text = sample === undefined ? "" : String(sample).trim(),
        short = text.length > 24 ? `${text.slice(0, 21)}…` : text,
        label = short ? `${header} — e.g. ${short}` : header;
      return `<option value="${escapeAttr(header)}">${escapeHtml(label)}</option>`;
    })
    .join("");
}
function normalisedHeader(header) {
  return String(header)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function headerTermScore(header, terms) {
  const name = normalisedHeader(header);
  return terms.some((term) => name === term)
    ? 90
    : terms.some((term) => name.includes(term))
      ? 65
      : 0;
}
function suggestColumns(rows, headers) {
  const postcodeTerms = ["postcode", "post code", "poa", "postal area", "zip"],
    valueTerms = [
      "revenue",
      "sales",
      "population",
      "customers",
      "customer",
      "amount",
      "value",
      "persons",
      "person records",
      "total",
    ];
  const ranked = headers.map((header) => {
      const cells = rows
          .map((row) => row[header])
          .filter((value) => !blank(value)),
        denominator = cells.length || 1,
        postcodeRate =
          cells.filter((value) => cleanPostcode(value) !== null).length /
          denominator,
        numericRate =
          cells.filter((value) => numeric(value) !== null).length / denominator,
        postcodeHeader = headerTermScore(header, postcodeTerms),
        valueHeader = headerTermScore(header, valueTerms),
        name = normalisedHeader(header),
        idLike =
          /(^|\s)(id|identifier|code|postcode|post code|poa|zip|year)(\s|$)/.test(
            name,
          ) || /(id|identifier)$/.test(name);
      return {
        header,
        postcodeRate,
        numericRate,
        postcodeHeader,
        valueHeader,
        postcodeScore: postcodeHeader + postcodeRate * 100,
        valueScore: valueHeader + numericRate * 100 - (idLike ? 120 : 0),
      };
    }),
    postcodes = [...ranked].sort((a, b) => b.postcodeScore - a.postcodeScore),
    postcode = postcodes[0],
    valuePool =
      ranked.length > 1
        ? ranked.filter((item) => item.header !== postcode.header)
        : ranked,
    values = [...valuePool].sort((a, b) => b.valueScore - a.valueScore),
    value = values[0],
    postcodeMargin =
      postcode.postcodeScore - (postcodes[1]?.postcodeScore ?? 0),
    valueMargin = value.valueScore - (values[1]?.valueScore ?? 0),
    postcodeLow =
      postcode.postcodeScore < 60 ||
      (postcode.postcodeHeader === 0 && postcode.postcodeRate < 0.5) ||
      (postcode.postcodeHeader === 0 && postcodeMargin < 15),
    valueLow =
      value.valueScore < 60 ||
      (value.valueHeader === 0 && value.numericRate < 0.6) ||
      (value.valueHeader === 0 && valueMargin < 15);
  return {
    postcode: postcode.header,
    value: value.header,
    lowConfidence: postcodeLow || valueLow,
  };
}
function renderPreview() {
  const detail = state.importDetail,
    rows = state.rows.slice(0, 10),
    headers = state.headers,
    confidence = state.columnConfidenceLow
      ? '<br><span class="selection-warning">Please confirm these columns.</span>'
      : "<br>Suggested from headings and sample values.";
  $("previewDetection").innerHTML =
    `${detail ? `Excel header row: <b>${detail.headerRow}</b><br>` : ""}Postcode column: <b>${escapeHtml($("postcodeColumn").value)}</b><br>Value column: <b>${escapeHtml($("valueColumn").value)}</b>${confidence}`;
  $("previewHead").innerHTML =
    `<tr>${headers.map((h) => `<th title="${escapeAttr(h)}">${escapeHtml(h)}</th>`).join("")}</tr>`;
  $("previewBody").innerHTML = rows
    .map(
      (row) =>
        `<tr>${headers.map((h) => `<td title="${escapeAttr(row[h] ?? "")}">${escapeHtml(row[h] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");
  $("previewToggle").textContent =
    `Preview: ${rows.length.toLocaleString()} of ${state.rows.length.toLocaleString()} rows`;
}
$("postcodeColumn").onchange = () => {
  renderPreview();
  renderValidation();
};
$("valueColumn").onchange = () => {
  if (!state.valueLabelEdited) $("valueLabel").value = $("valueColumn").value;
  recommendScale();
  renderPreview();
  renderValidation();
  updatePresentation();
  if (state.mapGenerated) buildMap();
};
function blank(v) {
  return v === null || v === undefined || String(v).trim() === "";
}
function cleanPostcode(v) {
  if (blank(v)) return null;
  const groups = String(v).trim().match(/\d+/g) || [];
  if (groups.length !== 1) return null;
  const digits = groups[0];
  if (digits.length === 4) return digits;
  if (digits.length === 3) return digits.padStart(4, "0");
  return null;
}
function numeric(v) {
  if (blank(v)) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim(),
    negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,%\s,]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : null;
}
function selectedNumericValues() {
  const column = $("valueColumn").value;
  return state.rows
    .map((row) => numeric(row[column]))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
}
function recommendScale() {
  const values = selectedNumericValues();
  if (!values.length) return;
  const mixed = values[0] < 0 && values[values.length - 1] > 0;
  $("scaleMode").value = mixed ? "diverging" : "quantile";
  if (mixed) {
    $("paletteMode").value = "blue-red";
    $("divergingCentre").value = "0";
  } else if ($("paletteMode").value === "blue-red") {
    $("paletteMode").value = "green";
  }
  updateScaleControls(values);
}
function updateScaleControls(values = selectedNumericValues()) {
  if (!values.length) return false;
  const min = values[0],
    max = values[values.length - 1],
    logOption = $("scaleMode").querySelector('option[value="log"]');
  logOption.disabled = min <= 0;
  let mode = $("scaleMode").value,
    warning = "";
  if (mode === "log" && min <= 0) {
    $("scaleMode").value = "quantile";
    mode = "quantile";
    warning =
      "Logarithmic scales require every value to be greater than zero. Quantiles are being used instead.";
  }
  $("classCountField").classList.toggle("hidden", mode === "continuous");
  $("divergingCentreField").classList.toggle("hidden", mode !== "diverging");
  const centre = Number($("divergingCentre").value);
  if (
    mode === "diverging" &&
    !(Number.isFinite(centre) && min < centre && max > centre)
  ) {
    warning =
      "Choose a centre with data values on both sides before using a diverging scale.";
  } else if (min < 0 && max > 0 && mode !== "diverging") {
    warning = "A diverging scale is recommended because the values cross zero.";
  }
  $("scaleWarning").textContent = warning;
  return !(mode === "diverging" && !(min < centre && max > centre));
}

function calculateValidation() {
  const pc = $("postcodeColumn").value,
    val = $("valueColumn").value,
    counts = new Map(),
    submittedPostcodes = new Set(),
    invalidRows = [],
    validEntries = [];
  let blankPostcodes = 0,
    invalidPostcodes = 0,
    blankValues = 0,
    nonNumericValues = 0;
  state.rows.forEach((row, i) => {
    const rawPostcode = row[pc],
      rawValue = row[val],
      postcodeBlank = blank(rawPostcode),
      valueBlank = blank(rawValue),
      postcode = cleanPostcode(rawPostcode),
      value = numeric(rawValue),
      reasons = [];
    if (postcodeBlank) {
      blankPostcodes++;
      reasons.push("Blank postcode");
    } else if (!postcode) {
      invalidPostcodes++;
      reasons.push("Invalid postcode");
    }
    if (valueBlank) {
      blankValues++;
      reasons.push("Blank value");
    } else if (value === null) {
      nonNumericValues++;
      reasons.push("Non-numeric value");
    }
    if (postcode) submittedPostcodes.add(postcode);
    if (reasons.length) {
      invalidRows.push({
        ...row,
        Reason: reasons.join("; "),
        "Source row": i + 2,
      });
      return;
    }
    counts.set(postcode, (counts.get(postcode) || 0) + 1);
    validEntries.push({ row, postcode, value, sourceRow: i + 2 });
  });
  const unique = [...submittedPostcodes],
    validCodes = state.geo
      ? new Set(state.geo.features.map((f) => String(f.properties.POA_CODE21)))
      : null,
    unmatchedCodes = validCodes
      ? new Set(unique.filter((code) => !validCodes.has(code)))
      : new Set(),
    unmatchedRows = validCodes
      ? validEntries
          .filter((entry) => unmatchedCodes.has(entry.postcode))
          .map((entry) => ({
            ...entry.row,
            Reason: "No matching ABS Postal Area",
            "Source row": entry.sourceRow,
          }))
      : [],
    duplicateRows = [...counts.values()].reduce(
      (total, count) => total + Math.max(0, count - 1),
      0,
    ),
    duplicatePostcodes = [...counts.values()].filter(
      (count) => count > 1,
    ).length,
    matchedCount = validCodes ? unique.length - unmatchedCodes.size : 0,
    matchedPercentage =
      validCodes && unique.length ? (matchedCount / unique.length) * 100 : null,
    mappedRows = validCodes ? validEntries.length - unmatchedRows.length : null,
    mappedRowPercentage =
      mappedRows !== null && state.rows.length
        ? (mappedRows / state.rows.length) * 100
        : null;
  return {
    totalRows: state.rows.length,
    validRows: validEntries.length,
    blankPostcodes,
    invalidPostcodes,
    blankValues,
    nonNumericValues,
    duplicateRows,
    duplicatePostcodes,
    uniquePostcodes: unique.length,
    unmatchedPostcodes: validCodes ? unmatchedCodes.size : null,
    matchedPercentage,
    matchedPostcodes: validCodes ? matchedCount : null,
    mappedRows,
    mappedRowPercentage,
    attentionRows: invalidRows.length,
    invalidRows,
    unmatchedRows,
  };
}
function renderValidation() {
  const result = calculateValidation();
  state.validation = result;
  const metrics = [
    ["Total input rows", result.totalRows],
    ["Valid rows", result.validRows],
    ["Blank postcode rows", result.blankPostcodes],
    ["Invalid postcode rows", result.invalidPostcodes],
    ["Blank value rows", result.blankValues],
    ["Non-numeric value rows", result.nonNumericValues],
    ["Duplicate input rows", result.duplicateRows],
    ["Postcodes affected by duplicates", result.duplicatePostcodes],
    ["Unique valid postcodes", result.uniquePostcodes],
    [
      "Postcodes not matched to ABS geography",
      result.unmatchedPostcodes === null
        ? "Checking…"
        : result.unmatchedPostcodes,
    ],
    [
      "Valid postcode geography match",
      result.matchedPercentage === null
        ? "Checking…"
        : result.uniquePostcodes === 0
          ? "No valid postcodes"
          : result.unmatchedPostcodes === 0
            ? `${result.matchedPostcodes.toLocaleString()} of ${result.uniquePostcodes.toLocaleString()} matched`
            : `${result.matchedPostcodes.toLocaleString()} of ${result.uniquePostcodes.toLocaleString()} matched (${result.matchedPercentage.toFixed(1)}%)`,
    ],
  ];
  $("validationMetrics").innerHTML = metrics
    .map(
      ([label, value]) =>
        `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`,
    )
    .join("");
  const geographyText =
      result.matchedPostcodes === null
        ? "Waiting for ABS geography"
        : result.uniquePostcodes === 0
          ? "No valid postcodes were available to match"
          : result.unmatchedPostcodes === 0
            ? `All ${result.uniquePostcodes.toLocaleString()} valid postcode${result.uniquePostcodes === 1 ? "" : "s"} matched ABS geography`
            : `${result.matchedPostcodes.toLocaleString()} of ${result.uniquePostcodes.toLocaleString()} valid postcodes matched ABS geography (${result.matchedPercentage.toFixed(1)}%)`,
    mappedText =
      result.mappedRows === null
        ? "Checking mapped rows…"
        : `${result.mappedRows.toLocaleString()} of ${result.totalRows.toLocaleString()} rows mapped`,
    usableText =
      result.mappedRows === 0
        ? "No rows are usable"
        : result.mappedRowPercentage === null
          ? "Calculating usability…"
          : `${result.mappedRowPercentage.toFixed(1)}% usable`,
    attentionText = `${result.attentionRows.toLocaleString()} row${result.attentionRows === 1 ? " needs" : "s need"} attention`,
    allSuccessful =
      result.mappedRows === result.totalRows && result.unmatchedPostcodes === 0,
    overviewTone =
      result.mappedRows === 0 ? "error" : allSuccessful ? "success" : "warning";
  $("validationOverview").className =
    `validation-overview validation-overview-${overviewTone}`;
  $("validationOverview").innerHTML =
    `<div><strong>${escapeHtml(mappedText)}</strong><span>${escapeHtml(usableText)}</span></div><div><strong>Geography match</strong><span>${escapeHtml(geographyText)}</span></div><div><strong>${escapeHtml(attentionText)}</strong><span>${result.attentionRows ? "Invalid or missing input" : "No row-level input issues"}</span></div>`;
  const warnings = [];
  if (result.invalidRows.length)
    warnings.push(
      `${result.invalidRows.length.toLocaleString()} row${result.invalidRows.length === 1 ? " has" : "s have"} invalid or missing input.`,
    );
  if (result.duplicateRows)
    warnings.push(
      `${result.duplicateRows.toLocaleString()} duplicate input row${result.duplicateRows === 1 ? " will" : "s will"} be combined across ${result.duplicatePostcodes.toLocaleString()} postcode${result.duplicatePostcodes === 1 ? "" : "s"}.`,
    );
  if (result.unmatchedPostcodes)
    warnings.push(
      `${result.unmatchedPostcodes.toLocaleString()} valid postcode${result.unmatchedPostcodes === 1 ? " does" : "s do"} not match the ABS geography.`,
    );
  $("validationWarnings").innerHTML = warnings.length
    ? warnings
        .map((w) => `<div class="validation-warning">${escapeHtml(w)}</div>`)
        .join("")
    : '<div class="validation-ok">No validation warnings found.</div>';
  $("validationStatus").className =
    `validation-compact validation-compact-${overviewTone}`;
  $("validationStatus").innerHTML =
    result.mappedRows === null
      ? "Checking rows"
      : result.mappedRows === 0
        ? `<span>No usable rows</span><span>${escapeHtml(attentionText)}</span>`
        : `<span>${escapeHtml(mappedText)}</span><span>${escapeHtml(usableText)}</span><span>${escapeHtml(attentionText)}</span>`;
  $("validationStatus").setAttribute(
    "aria-label",
    `${mappedText}. ${usableText}. ${attentionText}. ${geographyText}.`,
  );
  $("downloadInvalid").disabled = !result.invalidRows.length;
  $("downloadValidationUnmatched").disabled = !result.unmatchedRows.length;
}

$("buildButton").onclick = buildMap;
function currentValueLabel() {
  return $("valueLabel").value;
}
function setEditableText(display, value, placeholder) {
  display.replaceChildren();
  const text = document.createElement("span");
  text.textContent = value || placeholder;
  if (!value) text.className = "placeholder-text";
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✎";
  display.append(text, icon);
}
function updatePresentation() {
  setEditableText($("displayTitle"), $("mapTitle").value, "Add map title");
  setEditableText($("displaySubtitle"), $("mapSubtitle").value, "Add subtitle");
  setEditableText($("displaySource"), $("sourceNote").value, "Add source note");
}
function wireInlineEditor(displayId, inputId) {
  const display = $(displayId),
    input = $(inputId);
  let original = "",
    editing = false;
  function finish(save) {
    if (!editing) return;
    editing = false;
    if (!save) input.value = original;
    input.classList.add("hidden");
    display.classList.remove("hidden");
    updatePresentation();
    if (state.mapGenerated) {
      if (inputId === "mapTitle" || inputId === "mapSubtitle")
        map.invalidateSize({ pan: false });
    }
  }
  display.onclick = () => {
    original = input.value;
    editing = true;
    display.classList.add("hidden");
    input.classList.remove("hidden");
    input.focus();
    input.select();
  };
  input.onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
      display.focus();
    }
  };
  input.onblur = () => finish(true);
}
wireInlineEditor("displayTitle", "mapTitle");
wireInlineEditor("displaySubtitle", "mapSubtitle");
wireInlineEditor("displaySource", "sourceNote");
updatePresentation();
$("valueLabel").oninput = () => {
  state.valueLabelEdited = true;
  if (state.mapGenerated) buildMap();
};
const aggregationLabels = {
  sum: "Sum",
  avg: "Average",
  count: "Count",
  min: "Minimum",
  max: "Maximum",
};
function aggregateValues(values, method) {
  if (method === "avg")
    return values.reduce((a, b) => a + b, 0) / values.length;
  if (method === "count") return values.length;
  if (method === "min") return Math.min(...values);
  if (method === "max") return Math.max(...values);
  return values.reduce((a, b) => a + b, 0);
}
function formatValue(value) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "No value";
  const decimals = Number($("decimalPlaces").value),
    compact = $("compactNotation").checked,
    options = {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      notation: compact ? "compact" : "standard",
      useGrouping: $("thousandsSeparator").checked,
    },
    formatted = new Intl.NumberFormat("en-AU", options).format(Math.abs(value)),
    sign = value < 0 ? "-" : "",
    mode = $("numberFormat").value;
  if (mode === "currency") {
    const selected = $("currencySymbol").value,
      symbol =
        selected === "custom"
          ? $("customCurrencySymbol").value || "$"
          : selected;
    return `${sign}${symbol}${formatted}`;
  }
  if (mode === "percentage") return `${sign}${formatted}%`;
  return `${sign}${formatted}`;
}
function renderPinnedDetail() {
  const postcode = state.pinnedPostcode;
  if (!postcode || !state.values.has(postcode)) {
    $("pinnedDetail").classList.add("hidden");
    return;
  }
  const aggLabel = aggregationLabels[$("aggregation").value],
    valueLabel = currentValueLabel(),
    label = valueLabel ? `${valueLabel} · ${aggLabel}` : aggLabel;
  $("pinnedPostcode").textContent = `Postcode ${postcode}`;
  $("pinnedValue").textContent =
    `${label}: ${formatValue(state.values.get(postcode))}`;
  $("pinnedDetail").classList.remove("hidden");
}
function buildMap() {
  if (!state.geo)
    return alert(
      "The postcode boundaries are still loading. Please try again.",
    );
  const pc = $("postcodeColumn").value,
    val = $("valueColumn").value,
    agg = $("aggregation").value,
    aggLabel = aggregationLabels[agg],
    buckets = new Map(),
    unmatched = [];
  state.rows.forEach((row, i) => {
    const p = cleanPostcode(row[pc]),
      n = numeric(row[val]);
    if (!p || n === null) {
      unmatched.push({
        ...row,
        _reason: !p ? "Invalid postcode" : "Invalid value",
        _row: i + 2,
      });
      return;
    }
    if (!buckets.has(p)) buckets.set(p, []);
    buckets.get(p).push(n);
  });
  const values = new Map();
  for (const [p, arr] of buckets) values.set(p, aggregateValues(arr, agg));
  const validCodes = new Set(
    state.geo.features.map((f) => String(f.properties.POA_CODE21)),
  );
  for (const [p] of [...values])
    if (!validCodes.has(p)) {
      unmatched.push({
        [pc]: p,
        [val]: values.get(p),
        _reason: "No matching Postal Area",
      });
      values.delete(p);
    }
  state.values = values;
  state.unmatched = unmatched;
  const nums = [...values.values()].sort((a, b) => a - b);
  if (!nums.length)
    return alert(
      "No valid postcode and value pairs were found. Please check the selected columns and validation summary.",
    );
  if (!updateScaleControls(nums))
    return alert(
      "The diverging centre must have data values on both sides. Please adjust the centre or choose another scale.",
    );
  const scaleMode = $("scaleMode").value,
    centre = Number($("divergingCentre").value),
    classCount = scaleMode === "continuous" ? 9 : Number($("classCount").value);
  if (scaleMode === "diverging" && $("paletteMode").value !== "blue-red")
    $("paletteMode").value = "blue-red";
  if (scaleMode !== "diverging" && $("paletteMode").value === "blue-red")
    $("paletteMode").value = "green";
  state.scaleMode = scaleMode;
  state.scaleMin = nums[0];
  state.scaleMax = nums[nums.length - 1];
  state.scaleCentre = centre;
  state.palette = createPalette(
    $("paletteMode").value,
    classCount,
    $("reversePalette").checked,
  );
  state.breaks = makeBreaks(nums, scaleMode, classCount, centre);
  if (state.layer) map.removeLayer(state.layer);
  if (state.noDataLayer) map.removeLayer(state.noDataLayer);
  state.noDataLayer = L.geoJSON(state.geo, {
    renderer: L.svg({ padding: 0.5 }),
    interactive: false,
    style: noDataStyle(),
  }).addTo(map);
  state.layer = L.geoJSON(state.geo, {
    renderer: L.svg({ padding: 0.5 }),
    filter: (f) => values.has(String(f.properties.POA_CODE21)),
    style: postcodeStyle,
    onEachFeature: (f, l) => {
      const p = String(f.properties.POA_CODE21),
        v = values.get(p);
      const valueLabel = currentValueLabel(),
        label = valueLabel ? `${valueLabel} · ${aggLabel}` : aggLabel;
      l.bindTooltip(
        `<strong>Postcode ${p}</strong><br>${escapeHtml(label)}: <span class="tooltip-value">${escapeHtml(formatValue(v))}</span>`,
        { sticky: true },
      );
      l.on({
        mouseover: (e) =>
          e.target.setStyle({
            weight: Math.max(1.1, appearanceSettings().boundaryWidth + 0.6),
            color: "#4f5f58",
            opacity: 0.9,
            fillOpacity: Math.min(
              0.88,
              appearanceSettings().fillOpacity + 0.12,
            ),
          }),
        mouseout: (e) => state.layer.resetStyle(e.target),
        click: () => {
          state.pinnedPostcode = p;
          renderPinnedDetail();
        },
      });
    },
  }).addTo(map);
  map.fitBounds(state.layer.getBounds(), {
    padding: [12, 12],
    animate: false,
  });
  state.mapGenerated = true;
  $("emptyState").classList.add("hidden");
  $("exportButton").disabled = false;
  updatePresentation();
  $("displayMeta").textContent =
    `${values.size.toLocaleString()} postcodes mapped · ${aggLabel}`;
  renderLegend();
  renderSummary();
  renderPinnedDetail();
}
$("aggregation").onchange = () => {
  renderValidation();
  if (state.mapGenerated) buildMap();
};
function scaleControlsChanged(event) {
  if (event.target.id === "scaleMode") {
    if ($("scaleMode").value === "diverging")
      $("paletteMode").value = "blue-red";
    else if ($("paletteMode").value === "blue-red")
      $("paletteMode").value = "green";
  }
  if (event.target.id === "paletteMode") {
    if ($("paletteMode").value === "blue-red")
      $("scaleMode").value = "diverging";
    else if ($("scaleMode").value === "diverging")
      $("scaleMode").value = "quantile";
  }
  const ready = updateScaleControls();
  if (state.mapGenerated && ready) buildMap();
}
[
  "scaleMode",
  "paletteMode",
  "classCount",
  "reversePalette",
  "divergingCentre",
].forEach((id) => ($(id).onchange = scaleControlsChanged));
function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) =>
    parseInt(value.slice(offset, offset + 2), 16),
  );
}
function interpolateHex(a, b, amount) {
  const start = hexToRgb(a),
    end = hexToRgb(b),
    channels = start.map((value, i) =>
      Math.round(value + (end[i] - value) * amount),
    );
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
function paletteAt(stops, position) {
  const scaled = Math.max(0, Math.min(1, position)) * (stops.length - 1),
    index = Math.min(stops.length - 2, Math.floor(scaled));
  return interpolateHex(stops[index], stops[index + 1], scaled - index);
}
function createPalette(name, count, reverse) {
  const stops = paletteDefinitions[name] || paletteDefinitions.green,
    colours = Array.from({ length: count }, (_, i) =>
      paletteAt(stops, count === 1 ? 0.5 : i / (count - 1)),
    );
  return reverse ? colours.reverse() : colours;
}
function makeBreaks(nums, mode, k, centre = 0) {
  const min = nums[0],
    max = nums[nums.length - 1];
  if (min === max) return Array(k + 1).fill(min);
  if (mode === "quantile")
    return Array.from(
      { length: k + 1 },
      (_, i) =>
        nums[
          Math.min(nums.length - 1, Math.floor((i * (nums.length - 1)) / k))
        ],
    );
  if (mode === "log") {
    const start = Math.log(min),
      end = Math.log(max);
    return Array.from({ length: k + 1 }, (_, i) =>
      Math.exp(start + ((end - start) * i) / k),
    );
  }
  if (mode === "diverging")
    return Array.from({ length: k + 1 }, (_, i) => {
      const position = i / k;
      return position <= 0.5
        ? min + ((centre - min) * position) / 0.5
        : centre + ((max - centre) * (position - 0.5)) / 0.5;
    });
  return Array.from({ length: k + 1 }, (_, i) => min + ((max - min) * i) / k);
}
function continuousPosition(value) {
  if (state.scaleMin === state.scaleMax) return 0.5;
  return (value - state.scaleMin) / (state.scaleMax - state.scaleMin);
}
function colour(v) {
  if (state.scaleMin === state.scaleMax)
    return state.palette[Math.floor(state.palette.length / 2)];
  if (state.scaleMode === "continuous")
    return paletteAt(state.palette, continuousPosition(v));
  let index =
    state.breaks.findIndex((breakValue, i) => i > 0 && v <= breakValue) - 1;
  if (index < 0) index = state.palette.length - 1;
  return state.palette[Math.min(state.palette.length - 1, Math.max(0, index))];
}
function setLegendPosition(position) {
  const allowed = ["top-left", "top-right", "bottom-left", "bottom-right"];
  state.legendPosition = allowed.includes(position) ? position : "bottom-right";
  $("legend").classList.remove(...allowed.map((item) => `legend-${item}`));
  $("legend").classList.add(`legend-${state.legendPosition}`);
  $("legendPosition").value = state.legendPosition;
}
$("legendPosition").onchange = () =>
  setLegendPosition($("legendPosition").value);
function wireLegendDrag() {
  const handle = $("legend").querySelector(".legend-drag-handle");
  if (!handle) return;
  handle.onpointerdown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);
    map.dragging.disable();
  };
  handle.onpointerup = (event) => {
    const bounds = document.querySelector(".map-shell").getBoundingClientRect(),
      horizontal = event.clientX < bounds.left + bounds.width / 2 ? "left" : "right",
      vertical = event.clientY < bounds.top + bounds.height / 2 ? "top" : "bottom";
    setLegendPosition(`${vertical}-${horizontal}`);
    if (handle.hasPointerCapture(event.pointerId))
      handle.releasePointerCapture(event.pointerId);
    map.dragging.enable();
  };
  handle.onpointercancel = () => map.dragging.enable();
  L.DomEvent.disableClickPropagation($("legend"));
  L.DomEvent.disableScrollPropagation($("legend"));
}
function renderLegend() {
  const aggLabel = aggregationLabels[$("aggregation").value],
    valueLabel = currentValueLabel(),
    label = valueLabel ? `${valueLabel} · ${aggLabel}` : aggLabel;
  const entries =
    state.scaleMin === state.scaleMax
      ? `<div class="legend-row"><span class="swatch" style="background:${state.palette[Math.floor(state.palette.length / 2)]}"></span><span>${escapeHtml(formatValue(state.scaleMin))}</span></div>`
      : state.palette
          .map(
            (c, i) =>
              `<div class="legend-row"><span class="swatch" style="background:${c}"></span><span>${escapeHtml(formatValue(state.breaks[i]))} – ${escapeHtml(formatValue(state.breaks[i + 1]))}</span></div>`,
          )
          .join("");
  $("legend").innerHTML =
    `<div class="legend-drag-handle" title="Drag to another corner">Drag legend</div><div class="legend-title">${escapeHtml(label)}</div>${entries}<div class="legend-row legend-no-data"><span class="swatch"></span><span>No data</span></div>`;
  $("legend").classList.remove("hidden");
  setLegendPosition(state.legendPosition);
  wireLegendDrag();
}
function renderSummary() {
  const vals = [...state.values.values()],
    total = vals.reduce((a, b) => a + b, 0),
    aggLabel = aggregationLabels[$("aggregation").value],
    valueLabel = currentValueLabel(),
    label = valueLabel ? `${valueLabel} · ${aggLabel}` : aggLabel;
  $("summary").innerHTML =
    `<b>${state.values.size.toLocaleString()}</b> postcodes mapped<br>${escapeHtml(label)} result total: ${escapeHtml(formatValue(total))}<br>${state.unmatched.length.toLocaleString()} unmatched rows`;
  $("summary").classList.remove("hidden");
  $("unmatchedPanel").classList.toggle("hidden", !state.unmatched.length);
  renderUnmatchedPreview();
}
function renderUnmatchedPreview() {
  const rows = state.unmatched.slice(0, 10);
  if (!rows.length) return;
  const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))],
    labels = { _reason: "Reason", _row: "Source row" };
  $("unmatchedPreviewCount").textContent =
    `First ${rows.length} of ${state.unmatched.length.toLocaleString()}`;
  $("unmatchedHead").innerHTML =
    `<tr>${fields.map((field) => `<th title="${escapeAttr(labels[field] || field)}">${escapeHtml(labels[field] || field)}</th>`).join("")}</tr>`;
  $("unmatchedBody").innerHTML = rows
    .map(
      (row) =>
        `<tr>${fields.map((field) => `<td title="${escapeAttr(row[field] ?? "")}">${escapeHtml(row[field] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");
}
$("downloadUnmatched").onclick = () => {
  const csv = Papa.unparse(state.unmatched);
  downloadBlob(new Blob([csv], { type: "text/csv" }), "unmatched-rows.csv");
};
$("downloadInvalid").onclick = () => {
  const csv = Papa.unparse(state.validation.invalidRows);
  downloadBlob(new Blob([csv], { type: "text/csv" }), "invalid-rows.csv");
};
$("downloadValidationUnmatched").onclick = () => {
  const csv = Papa.unparse(state.validation.unmatchedRows);
  downloadBlob(new Blob([csv], { type: "text/csv" }), "abs-unmatched-rows.csv");
};
$("closePinnedDetail").onclick = () => {
  state.pinnedPostcode = null;
  $("pinnedDetail").classList.add("hidden");
};
function updateFormatControls() {
  const currency = $("numberFormat").value === "currency";
  $("currencyField").classList.toggle("hidden", !currency);
  $("customCurrencyField").classList.toggle(
    "hidden",
    !currency || $("currencySymbol").value !== "custom",
  );
  if (state.mapGenerated) buildMap();
}
[
  "numberFormat",
  "currencySymbol",
  "decimalPlaces",
  "compactNotation",
  "thousandsSeparator",
].forEach((id) => ($(id).onchange = updateFormatControls));
$("customCurrencySymbol").oninput = () => {
  if (state.mapGenerated) buildMap();
};
let exportInProgress = false;
function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
async function prepareMapForExport() {
  map.invalidateSize({ pan: false, animate: false });
  [state.noDataLayer, state.layer].filter(Boolean).forEach((group) =>
    group.eachLayer((layer) => {
      if (typeof layer.redraw === "function") layer.redraw();
    }),
  );
  await nextFrame();
  await nextFrame();
  await new Promise((resolve) => setTimeout(resolve, 350));
}
async function addExportOverlayImages(exportCard) {
  const svgs = [...exportCard.querySelectorAll(".leaflet-overlay-pane svg")];
  if (!svgs.length) throw new Error("Export SVG is not ready");
  const urls = [];
  for (const svg of svgs) {
    const copy = svg.cloneNode(true);
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.removeAttribute("class");
    copy.removeAttribute("style");
    const image = document.createElement("img");
    image.alt = "";
    image.style.cssText = svg.style.cssText;
    image.style.position = "absolute";
    image.style.left = svg.style.left || "0";
    image.style.top = svg.style.top || "0";
    image.style.pointerEvents = "none";
    image.width = Number(svg.getAttribute("width")) || svg.clientWidth;
    image.height = Number(svg.getAttribute("height")) || svg.clientHeight;
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(copy)], {
        type: "image/svg+xml",
      }),
    );
    urls.push(url);
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    svg.parentNode.insertBefore(image, svg);
    svg.style.visibility = "hidden";
  }
  return urls;
}
$("exportButton").onclick = async () => {
  if (exportInProgress || !state.mapGenerated) return;
  const button = $("exportButton");
  let exportStage = null;
  let overlayUrls = [];
  exportInProgress = true;
  button.disabled = true;
  try {
    await prepareMapForExport();
    if ($("basemapMode").value !== "none" && basemapTileError)
      throw new Error("BASEMAP_TILES_UNAVAILABLE");
    const liveCard = document.querySelector(".map-card"),
      liveOverlay = liveCard.querySelector(".leaflet-overlay-pane"),
      livePaths = liveOverlay?.querySelectorAll("svg path").length || 0,
      overlayStyle = liveOverlay ? getComputedStyle(liveOverlay) : null,
      overlayVisible =
        overlayStyle &&
        overlayStyle.display !== "none" &&
        overlayStyle.visibility !== "hidden" &&
        overlayStyle.opacity !== "0";
    if (!state.layer || !livePaths || !overlayVisible)
      throw new Error("Map overlay is not ready");

    exportStage = document.createElement("div");
    exportStage.className = "export-stage";
    const exportCard = liveCard.cloneNode(true),
      width = Math.ceil(liveCard.getBoundingClientRect().width);
    exportStage.style.width = `${width}px`;
    exportCard.style.width = `${width}px`;
    exportCard.querySelector("#exportButton")?.remove();
    exportCard.querySelector(".leaflet-control-layers")?.remove();
    const clonedOverlay = exportCard.querySelector(".leaflet-overlay-pane");
    if (clonedOverlay) {
      clonedOverlay.style.display = "block";
      clonedOverlay.style.visibility = "visible";
      clonedOverlay.style.opacity = "1";
    }
    exportStage.appendChild(exportCard);
    document.body.appendChild(exportStage);
    const clonedPaths = exportStage.querySelectorAll(
      ".leaflet-overlay-pane svg path",
    ).length;
    if (!clonedPaths) throw new Error("Export overlay is not ready");
    overlayUrls = await addExportOverlayImages(exportCard);

    await nextFrame();
    await nextFrame();
    const canvas = await html2canvas(exportCard, {
      backgroundColor: "#ffffff",
      logging: false,
      scale: 2,
      useCORS: true,
    });
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error("PNG creation failed")),
        "image/png",
      ),
    );
    downloadBlob(blob, "postcode-heatmap.png");
  } catch (error) {
    if ($("basemapMode").value !== "none") {
      $("appearanceWarning").textContent =
        "The selected basemap could not be included reliably because some map tiles were unavailable or blocked by browser security.";
      alert(
        "The PNG could not be created reliably with the selected basemap. Map tile providers and browser security can sometimes block image capture. Try again after the tiles load, or select No basemap.",
      );
    } else {
      alert("The map export could not be created. Please try again.");
    }
  } finally {
    if (exportStage) exportStage.remove();
    overlayUrls.forEach((url) => URL.revokeObjectURL(url));
    exportInProgress = false;
    button.disabled = !state.mapGenerated;
  }
};
function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function escapeAttr(s) {
  return escapeHtml(s);
}
