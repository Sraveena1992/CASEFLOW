import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOL_DIR = ROOT / "executas" / "caseflow"
PLUGIN = TOOL_DIR / "caseflow_plugin.py"


def rpc(*requests):
    payload = "".join(json.dumps(item) + "\n" for item in requests)
    completed = subprocess.run(
        [sys.executable, str(PLUGIN)],
        input=payload,
        text=True,
        capture_output=True,
        check=True,
        timeout=10,
    )
    return [json.loads(line) for line in completed.stdout.splitlines() if line.strip()]


def test_bundled_executa_handle_and_tool_id_are_consistent():
    app = json.loads((ROOT / "app.json").read_text(encoding="utf-8-sig"))
    app_manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8-sig"))
    descriptor = json.loads((TOOL_DIR / "executa.json").read_text(encoding="utf-8-sig"))
    tool_manifest = json.loads((TOOL_DIR / "manifest.json").read_text(encoding="utf-8-sig"))
    mapping = (ROOT / "bundle" / "anna-tool-ids.js").read_text(encoding="utf-8-sig")

    assert "caseflow" in app["bundled_executas"]
    assert any(x["tool_id"] == "bundled:caseflow" for x in app_manifest["required_executas"])
    assert "required:bundled:caseflow" in app_manifest["ui"]["host_api"]["tools"]
    assert descriptor["tool_id"] in mapping
    assert descriptor["tool_id"] == "tool-dev-caseflow"
    assert tool_manifest["name"] == descriptor["tool_id"]
    assert {x["name"] for x in tool_manifest["tools"]} >= {"ping", "evaluate_transition"}


def test_executa_json_rpc_health_ping_and_transition_validation():
    responses = rpc(
        {"jsonrpc": "2.0", "id": 1, "method": "health"},
        {"jsonrpc": "2.0", "id": 2, "method": "invoke", "params": {"tool": "ping", "arguments": {}}},
        {"jsonrpc": "2.0", "id": 3, "method": "invoke", "params": {
            "tool": "evaluate_transition",
            "arguments": {
                "evidence": "Supplier submitted the signed certificate.",
                "proposed_state": "IN_REVIEW",
                "proposed_blocker": "Awaiting compliance confirmation",
                "proposed_next_action": "Verify certificate with issuer",
                "reason": "Evidence was submitted; verification is still pending."
            }
        }},
        {"jsonrpc": "2.0", "id": 4, "method": "invoke", "params": {
            "tool": "evaluate_transition",
            "arguments": {"evidence": "", "proposed_state": "", "proposed_blocker": "", "proposed_next_action": "", "reason": ""}
        }},
    )
    assert responses[0]["result"]["status"] == "ready"
    assert responses[1]["result"]["data"]["pong"] is True
    valid = responses[2]["result"]["data"]
    assert valid["valid"] is True
    assert valid["status"] == "READY_FOR_HUMAN_REVIEW"
    assert valid["human_approval_required"] is True
    assert valid["evidence_independently_verified"] is False
    invalid = responses[3]["result"]["data"]
    assert invalid["valid"] is False
    assert invalid["status"] == "REVIEW_REQUIRED"
    assert invalid["human_approval_required"] is True


def test_frontend_invokes_mapped_executa_and_requires_validator_result():
    source = (ROOT / "bundle" / "app.js").read_text(encoding="utf-8")
    assert 'window.__ANNA_TOOL_IDS__.caseflow' in source
    assert 'state.anna.tools.invoke' in source
    assert 'method: "evaluate_transition"' in source
    assert 'validationData.status !== "READY_FOR_HUMAN_REVIEW"' in source
