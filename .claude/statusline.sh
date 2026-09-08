#!/bin/bash
# Status line for Claude Code. Reads a JSON blob on stdin and prints ONE line.
#
# Shows, left to right:
#   model · branch (+N uncommitted) · internal-repo branch · sandbox/prod hint
#
# Kept deliberately cheap — this runs on every render, so no network calls and
# no database queries.

input=$(cat)

# jq is not guaranteed on Windows; fall back to grep.
val() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null
  else
    printf '%s' "$input" | grep -oE "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed -E 's/.*"([^"]*)"$/\1/'
  fi
}

MODEL=$(val '.model.display_name' 'display_name')
[ -z "$MODEL" ] && MODEL="claude"

CODE_DIR="/d/all-clear/all-clear"
INT_DIR="/d/all-clear/all-clear-internal"

branch_of() { git -C "$1" rev-parse --abbrev-ref HEAD 2>/dev/null; }
dirty_of()  { git -C "$1" status --porcelain 2>/dev/null | grep -c . ; }

CB=$(branch_of "$CODE_DIR"); CD=$(dirty_of "$CODE_DIR")
IB=$(branch_of "$INT_DIR");  ID=$(dirty_of "$INT_DIR")

# Colours: dim grey separators, amber when there is uncommitted work.
DIM=$'\033[2m'; RST=$'\033[0m'; AMB=$'\033[33m'; GRN=$'\033[32m'; CYN=$'\033[36m'

out="${CYN}${MODEL}${RST}"

if [ -n "$CB" ]; then
  if [ "${CD:-0}" -gt 0 ]; then
    out="${out} ${DIM}·${RST} code:${AMB}${CB} +${CD}${RST}"
  else
    out="${out} ${DIM}·${RST} code:${GRN}${CB}${RST}"
  fi
fi

if [ -n "$IB" ]; then
  if [ "${ID:-0}" -gt 0 ]; then
    out="${out} ${DIM}·${RST} internal:${AMB}${IB} +${ID}${RST}"
  else
    out="${out} ${DIM}·${RST} internal:${GRN}${IB}${RST}"
  fi
fi

# A standing reminder that two databases exist and they are not the same one.
out="${out} ${DIM}· prod+sandbox${RST}"

printf '%s' "$out"
