# 標準の awk だけで JSON を扱う。C ロケールで UTF-8 をバイト列として保持する。
BEGIN {
    for (i = 1; i < 32; i++) control[sprintf("%c", i)] = i
    escape["\""] = "\""; escape["\\"] = "\\"; escape["/"] = "/"
    escape["b"] = "\b"; escape["f"] = "\f"; escape["n"] = "\n"
    escape["r"] = "\r"; escape["t"] = "\t"
    if (mode == "request") {
        printf "{\"passphrase\":%s,\"email\":%s,\"name\":%s}\n", \
            quote(ENVIRON["AICK_JSON_PASSPHRASE"]), quote(ENVIRON["AICK_JSON_EMAIL"]), \
            quote(ENVIRON["AICK_JSON_NAME"])
        exit
    }
}

{ input = input $0 "\n" }

END {
    if (mode == "request") exit
    pos = 1
    space()
    if (take() != "{") invalid()
    object(1)
    space()
    if (pos <= length(input)) invalid()

    if (mode == "endpoint") {
        print fields[endpoint]
    } else if (types["ok"] == "false") {
        if (types["message"] != "string" || fields["message"] == "") invalid()
        print fields["message"]
        exit 1
    } else {
        if (types["ok"] != "true" || types["code"] != "string" || fields["code"] == "" ||
            fields["code"] ~ /[[:cntrl:]]/ || types["redeem_url"] != "string" ||
            types["deadline"] != "string" || types["steps"] != "array") invalid()

        print "クレジットコード: " fields["code"]
        if (types["already_assigned"] == "true") print "すでに発行済みのコードです。"
        print "適用先: " fields["redeem_url"]
        print "適用期限: " fields["deadline"]
        print "適用手順:"
        for (i = 1; i <= step_count; i++) {
            sub(/^[0-9]+\.[[:blank:]]*/, "", steps[i])
            printf "%d. %s\n", i, steps[i]
        }
        print "AICK_CODE=" fields["code"]
    }
}

function invalid() {
    if (mode == "endpoint") print "配布用URLがまだ設定されていません。"
    else print "配布用APIの応答を読み取れませんでした。"
    exit 1
}

function quote(s,    out, c, j) {
    out = "\""
    for (j = 1; j <= length(s); j++) {
        c = substr(s, j, 1)
        if (c == "\"" || c == "\\") out = out "\\" c
        else if (c in control) out = out sprintf("\\u%04x", control[c])
        else out = out c
    }
    return out "\""
}

function take() { return substr(input, pos++, 1) }

function space() {
    while (substr(input, pos, 1) ~ /^[ \t\r\n]$/) pos++
}

function hex4(    num, j, digit) {
    for (j = 0; j < 4; j++) {
        digit = index("0123456789abcdef", tolower(take())) - 1
        if (digit < 0 || pos > length(input) + 1) invalid()
        num = 16 * num + digit
    }
    return num
}

function utf8(n) {
    if (n < 128) return sprintf("%c", n)
    if (n < 2048) return sprintf("%c%c", 192 + int(n / 64), 128 + n % 64)
    if (n < 65536) return sprintf("%c%c%c", 224 + int(n / 4096), 128 + int(n / 64) % 64, 128 + n % 64)
    return sprintf("%c%c%c%c", 240 + int(n / 262144), 128 + int(n / 4096) % 64, \
        128 + int(n / 64) % 64, 128 + n % 64)
}

function string(    out, c, n, low) {
    while (pos <= length(input)) {
        c = take()
        if (c == "\"") return out
        if (c in control) invalid()
        if (c == "\\") {
            c = take()
            if (c == "u") {
                n = hex4()
                if (n >= 55296 && n <= 56319) {
                    if (take() != "\\" || take() != "u") invalid()
                    low = hex4()
                    if (low < 56320 || low > 57343) invalid()
                    n = 65536 + (n - 55296) * 1024 + low - 56320
                } else if (n >= 56320 && n <= 57343) invalid()
                c = utf8(n)
            } else {
                if (!(c in escape)) invalid()
                c = escape[c]
            }
        }
        out = out c
    }
    invalid()
}

function object(root,    key, separator) {
    space()
    if (substr(input, pos, 1) == "}") { pos++; return }
    do {
        space()
        if (take() != "\"") invalid()
        key = string()
        space()
        if (take() != ":") invalid()
        value(root && key == "steps")
        if (root) {
            fields[key] = scalar
            types[key] = kind
        }
        space()
        separator = take()
    } while (separator == ",")
    if (separator != "}") invalid()
}

function list(capture,    separator) {
    space()
    if (substr(input, pos, 1) == "]") { pos++; return }
    do {
        value(0)
        if (capture) {
            if (kind != "string") invalid()
            steps[++step_count] = scalar
        }
        space()
        separator = take()
    } while (separator == ",")
    if (separator != "]") invalid()
}

function value(capture,    c, rest) {
    space()
    c = take()
    if (c == "\"") { scalar = string(); kind = "string"; return }
    if (c == "{") { object(0); kind = "object"; return }
    if (c == "[") { list(capture); kind = "array"; return }
    rest = substr(input, pos - 1)
    if (match(rest, /^(true|false|null)/)) kind = substr(rest, 1, RLENGTH)
    else if (match(rest, /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/)) kind = "number"
    else invalid()
    pos += RLENGTH - 1
    scalar = ""
}
