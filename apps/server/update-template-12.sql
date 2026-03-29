UPDATE mix_templates 
SET configuration = '{"mixType":"custom","trackCount":50,"sortBy":"random","sortDirection":"desc","customRules":{"yearRange":{"min":1999,"max":2021},"maxPopularArtists":50,"popularTracksOnly":true,"popularArtistsOnly":true},"schemaVersion":1}' 
WHERE id = 12;

SELECT id, name, configuration FROM mix_templates WHERE id = 12;
