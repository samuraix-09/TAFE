# Digital SAT adaptive simulation

The simulator retrieves the English and Math banks from PineSAT through the authenticated `opensat-start` Edge Function. The response schema comes from the live endpoint. The functions accept four distinct text choices, an A–D answer key, a known section domain and a source difficulty label. Duplicates and invalid items are discarded. Verified SVG fields render as image resources, and TeX renders with KaTeX in its untrusted mode. The provider may return questions without diagrams or explanations.

Each section uses a randomly sampled Medium Module 1 and disjoint Easy and Hard Module 2 pools. PostgreSQL chooses the Hard route at or above the configured threshold (default 70%) and Easy otherwise. The server stores the selected routes and snapshot privately with the attempt. The clock uses server deadlines, and the existing TAFE fullscreen pause rule applies. Module 2 starts timing when the server locks Module 1. Existing tests and previous results use their original flows.

Administrators can configure the four module durations, two thresholds and conversion tables through the test's SAT score editor. The simulation uses the source difficulty labels and a versioned TAFE practice conversion, not College Board routing, calibrated item parameters or official SAT scores. The [OpenSAT data use terms](https://api.github.com/repos/Anas099X/OpenSAT/license) allow reuse of its question database. TAFE uses its own implementation.

Deploy the database migration and the `opensat-start` Edge Function together with the frontend. The Edge Function needs the project's built-in Supabase environment variables and access to the PineSAT API.
