-- Minimal pure-Lua JSON decoder for older Lightroom versions (e.g. 5.7.1)
-- Supports: objects, arrays, strings, numbers, true/false/null.
-- Usage: local JSON = require "JSON"; local t = JSON.decode(str)

local JSON = {}

local function decodeError(s, i, msg)
  error(string.format("JSON decode error at char %d: %s", i, msg))
end

local function isSpace(c)
  return c == " " or c == "\t" or c == "\r" or c == "\n"
end

local function skipSpaces(s, i)
  while true do
    local c = s:sub(i, i)
    if c == "" then return i end
    if not isSpace(c) then return i end
    i = i + 1
  end
end

local function parseLiteral(s, i, literal, value)
  if s:sub(i, i + #literal - 1) == literal then
    return value, i + #literal
  end
  decodeError(s, i, "expected " .. literal)
end

local function parseNumber(s, i)
  local start = i
  local c = s:sub(i, i)
  if c == "-" then i = i + 1 end

  local d = s:sub(i, i)
  if d == "0" then
    i = i + 1
  elseif d:match("%d") then
    repeat
      i = i + 1
      d = s:sub(i, i)
    until d == "" or not d:match("%d")
  else
    decodeError(s, i, "invalid number")
  end

  if s:sub(i, i) == "." then
    i = i + 1
    local digits = 0
    while s:sub(i, i):match("%d") do
      i = i + 1
      digits = digits + 1
    end
    if digits == 0 then decodeError(s, i, "invalid number fraction") end
  end

  local e = s:sub(i, i)
  if e == "e" or e == "E" then
    i = i + 1
    local sign = s:sub(i, i)
    if sign == "+" or sign == "-" then i = i + 1 end
    local digits = 0
    while s:sub(i, i):match("%d") do
      i = i + 1
      digits = digits + 1
    end
    if digits == 0 then decodeError(s, i, "invalid number exponent") end
  end

  local num = tonumber(s:sub(start, i - 1))
  if num == nil then decodeError(s, start, "invalid number") end
  return num, i
end

local function parseString(s, i)
  if s:sub(i, i) ~= "\"" then decodeError(s, i, "expected string") end
  i = i + 1
  local out = {}
  while true do
    local c = s:sub(i, i)
    if c == "" then decodeError(s, i, "unterminated string") end
    if c == "\"" then
      return table.concat(out), i + 1
    end
    if c == "\\" then
      local esc = s:sub(i + 1, i + 1)
      if esc == "" then decodeError(s, i, "unterminated escape") end
      if esc == "\"" or esc == "\\" or esc == "/" then
        out[#out + 1] = esc
        i = i + 2
      elseif esc == "b" then out[#out + 1] = "\b"; i = i + 2
      elseif esc == "f" then out[#out + 1] = "\f"; i = i + 2
      elseif esc == "n" then out[#out + 1] = "\n"; i = i + 2
      elseif esc == "r" then out[#out + 1] = "\r"; i = i + 2
      elseif esc == "t" then out[#out + 1] = "\t"; i = i + 2
      elseif esc == "u" then
        local hex = s:sub(i + 2, i + 5)
        if not hex:match("^[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]$") then
          decodeError(s, i, "invalid unicode escape")
        end
        local code = tonumber(hex, 16)
        -- Basic BMP encoding to UTF-8 (no surrogate pair handling).
        if code <= 0x7F then
          out[#out + 1] = string.char(code)
        elseif code <= 0x7FF then
          out[#out + 1] = string.char(0xC0 + math.floor(code / 0x40), 0x80 + (code % 0x40))
        else
          out[#out + 1] = string.char(
            0xE0 + math.floor(code / 0x1000),
            0x80 + (math.floor(code / 0x40) % 0x40),
            0x80 + (code % 0x40)
          )
        end
        i = i + 6
      else
        decodeError(s, i, "invalid escape")
      end
    else
      out[#out + 1] = c
      i = i + 1
    end
  end
end

local parseValue

local function parseArray(s, i)
  if s:sub(i, i) ~= "[" then decodeError(s, i, "expected array") end
  i = i + 1
  local arr = {}
  i = skipSpaces(s, i)
  if s:sub(i, i) == "]" then return arr, i + 1 end
  while true do
    local v
    v, i = parseValue(s, i)
    arr[#arr + 1] = v
    i = skipSpaces(s, i)
    local c = s:sub(i, i)
    if c == "," then
      i = skipSpaces(s, i + 1)
    elseif c == "]" then
      return arr, i + 1
    else
      decodeError(s, i, "expected ',' or ']'")
    end
  end
end

local function parseObject(s, i)
  if s:sub(i, i) ~= "{" then decodeError(s, i, "expected object") end
  i = i + 1
  local obj = {}
  i = skipSpaces(s, i)
  if s:sub(i, i) == "}" then return obj, i + 1 end
  while true do
    local key
    key, i = parseString(s, i)
    i = skipSpaces(s, i)
    if s:sub(i, i) ~= ":" then decodeError(s, i, "expected ':'") end
    i = skipSpaces(s, i + 1)
    local val
    val, i = parseValue(s, i)
    obj[key] = val
    i = skipSpaces(s, i)
    local c = s:sub(i, i)
    if c == "," then
      i = skipSpaces(s, i + 1)
    elseif c == "}" then
      return obj, i + 1
    else
      decodeError(s, i, "expected ',' or '}'")
    end
  end
end

parseValue = function(s, i)
  i = skipSpaces(s, i)
  local c = s:sub(i, i)
  if c == "{" then return parseObject(s, i) end
  if c == "[" then return parseArray(s, i) end
  if c == "\"" then return parseString(s, i) end
  if c == "-" or c:match("%d") then return parseNumber(s, i) end
  if c == "t" then return parseLiteral(s, i, "true", true) end
  if c == "f" then return parseLiteral(s, i, "false", false) end
  if c == "n" then return parseLiteral(s, i, "null", nil) end
  decodeError(s, i, "unexpected character '" .. c .. "'")
end

function JSON.decode(s)
  if type(s) ~= "string" then
    error("JSON.decode expects a string")
  end
  local val, i = parseValue(s, 1)
  i = skipSpaces(s, i)
  if i <= #s then
    decodeError(s, i, "trailing characters")
  end
  return val
end

return JSON

