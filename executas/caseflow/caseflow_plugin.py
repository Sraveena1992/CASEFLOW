import json
import sys

MANIFEST = {
    "name": "tool-dev-caseflow",
    "version": "0.1.0",
    "tools": [
        {
            "name": "ping",
            "description": "Smoke-test the CASEFLOW Executa.",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
        {
            "name": "evaluate_transition",
            "description": (
                "Validate a proposed case-state transition before human review. "
                "Checks required fields and evidence presence; does not independently "
                "verify evidence or approve the transition."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "evidence": {"type": "string"},
                    "proposed_state": {"type": "string"},
                    "proposed_blocker": {"type": "string"},
                    "proposed_next_action": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": [
                    "evidence",
                    "proposed_state",
                    "proposed_blocker",
                    "proposed_next_action",
                    "reason",
                ],
                "additionalProperties": False,
            },
        },
    ],
}


def invoke(method: str, args: dict) -> dict:
    if method == "ping":
        return {"success": True, "data": {"pong": True}}

    if method == "evaluate_transition":
        required = [
            "evidence",
            "proposed_state",
            "proposed_blocker",
            "proposed_next_action",
            "reason",
        ]

        missing = [
            key for key in required
            if not isinstance(args.get(key), str) or not args[key].strip()
        ]

        if missing:
            return {
                "success": True,
                "data": {
                    "status": "REVIEW_REQUIRED",
                    "valid": False,
                    "missing_fields": missing,
                    "human_approval_required": True,
                    "evidence_independently_verified": False,
                },
            }

        evidence = args["evidence"].strip()

        return {
            "success": True,
            "data": {
                "status": "READY_FOR_HUMAN_REVIEW",
                "valid": True,
                "evidence_characters": len(evidence),
                "human_approval_required": True,
                "evidence_independently_verified": False,
                "message": (
                    "Required fields are present. This check does not establish "
                    "whether the proposal is factually supported by the evidence."
                ),
            },
        }

    return {"success": False, "error": f"unknown method: {method}"}


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        req = json.loads(line)

        try:
            rpc_method = req.get("method")

            if rpc_method == "describe":
                result = MANIFEST
            elif rpc_method == "health":
                result = {"status": "ready"}
            elif rpc_method == "invoke":
                params = req.get("params", {})
                result = invoke(
                    params.get("tool", ""),
                    params.get("arguments", {}),
                )
            else:
                raise ValueError(f"unknown rpc: {rpc_method}")

            response = {
                "jsonrpc": "2.0",
                "id": req.get("id"),
                "result": result,
            }
        except Exception as exc:
            response = {
                "jsonrpc": "2.0",
                "id": req.get("id"),
                "error": {"code": -32601, "message": str(exc)},
            }

        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
