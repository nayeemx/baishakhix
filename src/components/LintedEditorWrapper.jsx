import { useState } from "react";
import TiptapEditor from "./TiptapEditor";
// ...import your linter library here...

const fakeLinter = (text) => {
  // Replace with real linter logic or API call
  const issues = [];
  if (text.includes("teh")) issues.push({ message: "Did you mean 'the'?", index: text.indexOf("teh") });
  // ...add more rules...
  return issues;
};

const LintedEditorWrapper = () => {
  const [content, setContent] = useState("");
  const [lintIssues, setLintIssues] = useState([]);

  const handleChange = (html) => {
    setContent(html);
    const plainText = document.createElement("div");
    plainText.innerHTML = html;
    const text = plainText.textContent || plainText.innerText || "";
    setLintIssues(fakeLinter(text));
  };

  return (
    <div>
      <TiptapEditor content={content} onChange={handleChange} />
      <div className="mt-2">
        {lintIssues.length > 0 ? (
          <ul className="text-red-600">
            {lintIssues.map((issue, idx) => (
              <li key={idx}>{issue.message}</li>
            ))}
          </ul>
        ) : (
          <span className="text-green-600">No issues found!</span>
        )}
      </div>
    </div>
  );
};

export default LintedEditorWrapper;
