"""Test check selection and failure handling without running app checks."""
import contextlib
import importlib.util
import io
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('verify', Path(__file__).with_name('verify.py'))
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class VerifyTests(unittest.TestCase):
    def run_silently(self, args):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return verify.main(args)

    def test_default_and_explicit_all_run_every_check(self):
        for args in ([], ['all']):
            with self.subTest(args=args), patch.object(verify.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)) as run:
                self.assertEqual(self.run_silently(args), 0)
                self.assertEqual([call.args[0] for call in run.call_args_list], list(verify.CHECKS.values()))
                self.assertEqual(run.call_args.kwargs['cwd'], verify.ROOT)
                self.assertEqual(run.call_args.kwargs['env']['PYTHONDONTWRITEBYTECODE'], '1')

    def test_selection_preserves_order_and_skips_duplicates(self):
        with patch.object(verify.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)) as run:
            self.assertEqual(self.run_silently(['convex', 'lint', 'convex']), 0)
            self.assertEqual([call.args[0] for call in run.call_args_list], [verify.CHECKS['convex'], verify.CHECKS['lint']])

    def test_invalid_selection_runs_nothing(self):
        for args in (['typo'], ['all', 'lint']):
            with self.subTest(args=args), patch.object(verify.subprocess, 'run') as run:
                with self.assertRaises(SystemExit) as error:
                    self.run_silently(args)
                self.assertEqual(error.exception.code, 2)
                run.assert_not_called()

    def test_failure_stops_remaining_checks_and_preserves_exit_status(self):
        for status, expected in ((7, 7), (-15, 143)):
            with self.subTest(status=status), patch.object(verify.subprocess, 'run', return_value=subprocess.CompletedProcess([], status)) as run:
                self.assertEqual(self.run_silently(['lint', 'tests']), expected)
                self.assertEqual(run.call_count, 1)

    def test_missing_executable_fails_without_running_later_checks(self):
        with patch.object(verify.subprocess, 'run', side_effect=FileNotFoundError('missing')) as run:
            self.assertEqual(self.run_silently(['lint', 'tests']), 1)
            self.assertEqual(run.call_count, 1)


if __name__ == '__main__':
    unittest.main()
