# Rent Tool Context

Rent Tool helps a person turn a salary offer and a possible move into a practical rent decision. This glossary names the user-facing concepts that the planning and comparison flows share.

## Planning

**Rent plan**:
A salary offer paired with an active city and the rent target calculated for that city.
_Avoid_: calculator, scenario

**Active city**:
The city whose rent target, affordability result, local context, and next steps are currently shown.
_Avoid_: selected location, destination

**Rent target**:
The monthly amount the rent plan treats as affordable under the product’s 30%-of-gross-income planning rule.
_Avoid_: approved rent, guaranteed budget

**Rent estimate**:
A sourced monthly rent statistic shown as market context, with its meaning, geography, and reporting period disclosed.
_Avoid_: quote, lease price

**Comparison set**:
Up to five comparison entries a person has chosen to inspect side by side against the rent plan’s decision criteria. Opening an empty comparison set from a rent plan begins with an entry for the active city. Clearing a comparison set removes every entry and its committed salary.
_Avoid_: shortlist, scenarios

**Comparison entry**:
A city and its committed salary within a comparison set. A new entry commits the rent plan’s salary when available, or $80,000 otherwise. Only a valid salary can become committed; an incomplete or invalid editing value does not replace the last committed salary. The committed salary belongs to that entry, remains independent of the rent plan’s salary and other comparison entries, and is preserved when the comparison set is shared. Removing an entry removes both its city and committed salary.
_Avoid_: scenario, row

**Decision brief**:
A concise comparison result that names the leading city for a chosen criterion and explains the relevant trade-off.
_Avoid_: winner, recommendation

**Housing setup**:
One-bedroom, two-bedroom, or shared two-bedroom. Shared housing assumes two people
split the two-bedroom rent equally. The setup applies across the rent plan and comparison set.

**Available spending room**:
Monthly take-home pay less the selected housing rent, recurring expenses, and savings target.
A negative value remains visible as a shortfall. Expenses and savings apply to every comparison entry.
The gross-income rent target remains a separate planning rule.

**Entered take-home pay**:
An optional monthly paycheck amount for one city and salary offer. Each comparison entry
can retain its own amount. Changing that offer's salary clears the entered amount; changing
the active city clears the active plan's amount. Equivalent salary calculations use the
reference's entered pay when available and modeled taxes for the required salaries.
