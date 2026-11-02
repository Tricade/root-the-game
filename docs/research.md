# Laboratory and research branches

Research is paid work over time. The lab runs **one project at a time**, reserves **10% of project throughput**, and charges research points when it starts. Its effect activates once, on completion. Cancelling frees the lab but refunds neither the points nor the time already spent. Losing every reachable server, or entering a global data/utility crisis, pauses the lab. It resumes after recovery, including during offline catch-up.

| Branch                | Technologies                                                                              | Main trade-off                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Network architecture  | Packet switching, thermal telemetry, load balancing, failover procedures                  | More useful project work and lower risk/wear; physical power and cooling are still required.                               |
| Customer operations   | Service Desk, incident support, capacity planning, account management                     | Faster staffed work, more patient clients, lower resource demand and a better retention chance. Customers can still leave. |
| Operations automation | Provisioning workflows, predictive maintenance, energy coordination, lab automation       | Less manual overhead and lower operating costs; staffing and lab time still matter.                                        |
| Research & AI         | Experimental methods, knowledge transfer, AI validation methods, production model serving | Better passive research and actual AI returns; advanced nodes also depend on other branches and later sectors.             |

The clickable branch overview leads to each technology's detail card. Prerequisite links also lead across branches. Cards show the required sector, points, lab time, effect and current reason a project cannot start. The first projects cost 25–40 RP and take 10–15 minutes; advanced technologies take up to three hours and require sectors up to 6. Lab time forces a choice between an immediate operational need and a longer investment.

The five existing repeatable tracks remain: routing, cooling, contract analysis, automation and synthesis. New levels require their corresponding foundation technology and take `min(4 hours, 5 minutes + 2 minutes × current level)`. Their existing cost curves and diminishing-return effects remain in effect. Older saves keep every completed level; migration does not make players research those levels again.

Completed technology IDs, a paid project's price, target level and remaining time are saved in schema 7. Invalid IDs, unmet prerequisites and fabricated paid-project records are rejected. The catalog in `engine/research-catalog.js` defines branches, dependencies, costs, times and effects; additional branches can be added without another independent lab simulation. Add translations and effect tests whenever extending it.

Achievements are a separate menu item, with their own rewards and notifications. They do not occupy the lab or spend research points.
