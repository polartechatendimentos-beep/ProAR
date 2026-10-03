import {describe,it,expect} from "vitest";
import {forecastStock,consolidatePurchaseSuggestions} from "../lib/predictive-stock";
import {suggestAssignments} from "../lib/smart-routing";
import {customerHealth} from "../lib/customer-health";
import {integrationHealth} from "../lib/integration-center";
import {platformHealth} from "../lib/platform-health";
describe("ProAR intelligence foundations",()=>{
 it("forecasts shortage using reservations and scheduled demand",()=>{const x=forecastStock({productId:"p",name:"Cobre",available:20,reserved:5,minimum:10,scheduledDemand:12,horizonDays:7});expect(x.projected).toBe(3);expect(x.suggestedPurchase).toBe(7);expect(x.status).toBe("attention");});
 it("consolidates only purchase needs",()=>expect(consolidatePurchaseSuggestions([{productId:"p",name:"P",available:1,reserved:0,minimum:5,scheduledDemand:2,horizonDays:7}])).toHaveLength(1));
 it("routes by skill region and capacity",()=>expect(suggestAssignments([{id:"os",region:"Mirassol",date:"2026-10-03",requiredSkills:["VRF"],estimatedMinutes:60}],[{id:"t",regions:["Mirassol"],skills:["VRF"],availableMinutes:120}])[0].technicianId).toBe("t"));
 it("reduces customer health on objective operational risks",()=>expect(customerHealth({overdueAmount:100,pmocOverdue:1}).status).not.toBe("healthy"));
 it("flags repeated integration failures",()=>expect(integrationHealth({id:"mp",name:"Mercado Pago",enabled:true,consecutiveFailures:3}).status).toBe("critical"));
 it("scores manager platform health",()=>expect(platformHealth([{name:"db",ok:true},{name:"webhook",ok:false,critical:true}]).status).toBe("critical"));
});
