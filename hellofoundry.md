# Hello Foundry

## Executive Summary

Across 631 Intercom conversations, the most critical issues are concentrated in onboarding and payroll: hired applicants frequently fail to appear in onboarding flows, I-9/E-Verify errors are blocking compliance, and payroll defects (direct deposit failures, overtime/hours not saving, and blocked runs) are directly impacting employees getting paid. Customers are asking for more reliable, visible automation between Hiring → Onboarding and within Payroll—specifically immediate hired-to-onboarding sync with status transparency, better error validation/messaging, and stronger controls and safeguards around payroll corrections, off-cycle runs, and onboarding module management.

## DataFrames Created

- `summary_executive_df` (1 row) – Executive summary text
- `summary_all_feedback_df` (137 rows) – All feedback with feedback_type column
- `summary_issues_df` (54 rows) – CustomerIssue only (bugs/issues)
- `summary_features_df` (83 rows) – FeatureRequest only (new capabilities)
- `summary_testimonials_df` (0 rows) – Testimonials only (positive feedback)
- `summary_batch_results_df` (174 rows) – Raw batch results with batch_num
- `summary_stats_df` (5 rows) – API call stats
