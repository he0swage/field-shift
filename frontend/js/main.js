// Field Shift — boot (loaded last, after every step module)
'use strict';

renderRegionList(); renderRegion(); renderRotation(); renderCrops(); renderFit(); renderPriorities();
go((location.hash.match(/step-(\d)/) || [])[1] || 1, { focus: false });
