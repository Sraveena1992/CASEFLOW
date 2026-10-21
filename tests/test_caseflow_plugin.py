import unittest

from executas.caseflow.caseflow_plugin import invoke


class TestCaseflowPlugin(unittest.TestCase):
    def setUp(self):
        self.valid_args = {
            "evidence": "Finance reports approval; bank confirmation is missing.",
            "proposed_state": "Payment status unresolved",
            "proposed_blocker": "Transaction reference is missing",
            "proposed_next_action": "Request bank confirmation from Finance",
            "reason": "The transfer has not been independently confirmed.",
        }

    def test_ping_succeeds(self):
        result = invoke("ping", {})
        self.assertTrue(result["success"])
        self.assertTrue(result["data"]["pong"])

    def test_complete_proposal_is_ready_for_human_review(self):
        result = invoke("evaluate_transition", self.valid_args)
        data = result["data"]

        self.assertEqual(data["status"], "READY_FOR_HUMAN_REVIEW")
        self.assertTrue(data["valid"])
        self.assertTrue(data["human_approval_required"])

    def test_missing_field_requires_review(self):
        args = dict(self.valid_args)
        args["proposed_next_action"] = ""

        result = invoke("evaluate_transition", args)
        data = result["data"]

        self.assertEqual(data["status"], "REVIEW_REQUIRED")
        self.assertFalse(data["valid"])
        self.assertIn("proposed_next_action", data["missing_fields"])

    def test_whitespace_only_fields_are_rejected(self):
        args = dict(self.valid_args)
        args["reason"] = "   "

        result = invoke("evaluate_transition", args)

        self.assertFalse(result["data"]["valid"])
        self.assertIn("reason", result["data"]["missing_fields"])

    def test_evidence_is_not_claimed_as_independently_verified(self):
        result = invoke("evaluate_transition", self.valid_args)
        self.assertFalse(result["data"]["evidence_independently_verified"])

    def test_unknown_method_fails(self):
        result = invoke("not_a_real_method", {})
        self.assertFalse(result["success"])
        self.assertIn("unknown method", result["error"])


if __name__ == "__main__":
    unittest.main()
