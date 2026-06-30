# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { upsertTopic, updateTopicEvaluationState, upsertEvaluation, upsertMatch, upsertRun, finishRun, upsertPresence, upsertModelTokenUsage, upsertScrapeCursor, getBoardData } from '@trae-contest/dataconnect-generated';


// Operation UpsertTopic:  For variables, look at type UpsertTopicVars in ../index.d.ts
const { data } = await UpsertTopic(dataConnect, upsertTopicVars);

// Operation UpdateTopicEvaluationState:  For variables, look at type UpdateTopicEvaluationStateVars in ../index.d.ts
const { data } = await UpdateTopicEvaluationState(dataConnect, updateTopicEvaluationStateVars);

// Operation UpsertEvaluation:  For variables, look at type UpsertEvaluationVars in ../index.d.ts
const { data } = await UpsertEvaluation(dataConnect, upsertEvaluationVars);

// Operation UpsertMatch:  For variables, look at type UpsertMatchVars in ../index.d.ts
const { data } = await UpsertMatch(dataConnect, upsertMatchVars);

// Operation UpsertRun:  For variables, look at type UpsertRunVars in ../index.d.ts
const { data } = await UpsertRun(dataConnect, upsertRunVars);

// Operation FinishRun:  For variables, look at type FinishRunVars in ../index.d.ts
const { data } = await FinishRun(dataConnect, finishRunVars);

// Operation UpsertPresence:  For variables, look at type UpsertPresenceVars in ../index.d.ts
const { data } = await UpsertPresence(dataConnect, upsertPresenceVars);

// Operation UpsertModelTokenUsage:  For variables, look at type UpsertModelTokenUsageVars in ../index.d.ts
const { data } = await UpsertModelTokenUsage(dataConnect, upsertModelTokenUsageVars);

// Operation UpsertScrapeCursor:  For variables, look at type UpsertScrapeCursorVars in ../index.d.ts
const { data } = await UpsertScrapeCursor(dataConnect, upsertScrapeCursorVars);

// Operation GetBoardData: 
const { data } = await GetBoardData(dataConnect);


```