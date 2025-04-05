(function() {
  _.templateSettings = {
    interpolate: /\{\{(.+?)\}\}/g
  };
  var historyItemTemplate = _.template('\
  <li class="diff-history-item" onclick="onClickHistoryItem({{index}})">\
    <span class="history-timestamp">{{time}}</span>\
    <span class="history-string">{{historyString}}</span>\
  </li>');
  var diffHistoryStr = localStorage.getItem('diff-history');
  var diffHistory = diffHistoryStr ? JSON.parse(diffHistoryStr) : [];
  var dontTriggerSaveDiff = false;
  renderDiffHistory();

  function JsonInputView(el, initialText) {
    this.el = el;
    var codemirror = this.codemirror = CodeMirror.fromTextArea(this.el, {
      lineNumbers: true,
      mode: {name: "javascript", json: true},
      matchBrackets: true,
      theme: 'tomorrow-night'
    });
    if (initialText) {
      codemirror.setValue(initialText);
    }
    var self = this;

    codemirror.on('inputRead', function (cm, e) {
      if (e.origin === 'paste') {
        autoFormat();
      }
      triggerChange();
    });
    codemirror.on('keyup', triggerChange);
    codemirror.on('change', triggerChange);
    codemirror.on('clear', function () {
      console.log(arguments);
    });

    var oldValue = '';
    function triggerChange() {
      var text = codemirror.getValue();
        if (text !== oldValue) {
          self.trigger('change');
        }
      oldValue = text;
    }

    function autoFormat() {
      var totalLines = codemirror.lineCount();
      codemirror.autoFormatRange({line:0, ch:0}, {line:totalLines});
      codemirror.setSelection({line:0, ch:0});
    }
  }

  JsonInputView.prototype.getText = function () {
    return this.codemirror.getValue();
  };

  JsonInputView.prototype.setText = function (text) {
    return this.codemirror.setValue(text);
  };

  JsonInputView.prototype.highlightRemoval = function (diff) {
    this._highlight(diff, '#DD4444');
  };

  JsonInputView.prototype.highlightAddition = function (diff) {
    this._highlight(diff, isLightTheme() ? '#4ba2ff' : '#2E6DFF');
  };

  JsonInputView.prototype.highlightChange = function (diff) {
    this._highlight(diff, isLightTheme() ? '#E5E833' : '#9E9E00');
  };

  JsonInputView.prototype._highlight = function (diff, color) {
    var pos = getStartAndEndPosOfDiff(this.getText(), diff);
    this.codemirror.markText(pos.start, pos.end, {
      css: 'background-color: ' + color
    });
  };

  JsonInputView.prototype.clearMarkers = function () {
    this.codemirror.getAllMarks().forEach(function (marker) {
      marker.clear();
    });
  };

    function getStartAndEndPosOfDiff(textValue, diff) {
        var result = parse(textValue);
        var pointers = result.pointers;
        var path = diff.path;
        var start = {
            line: pointers[path].key ? pointers[path].key.line : pointers[path].value.line,
            ch: pointers[path].key ? pointers[path].key.column : pointers[path].value.column
        };
        var end = {
            line: pointers[path].valueEnd.line,
            ch: pointers[path].valueEnd.column
        };

        return {
            start: start,
            end: end
        }
    }

  function indexToPos(textValue, i) {
    var beginStr = textValue.substr(0, i);
    var lines = beginStr.split('\n');
    return {
      line: lines.length - 1,
      ch: lines[lines.length - 1].length
    };
  }

  function isLightTheme() {
    return $('body').hasClass('lighttheme');
  }

  BackboneEvents.mixin(JsonInputView.prototype);
  var currentDiff = localStorage.getItem('current-diff') && JSON.parse(localStorage.getItem('current-diff'));

  var leftInputView = new JsonInputView(document.getElementById('json-diff-left'), currentDiff && currentDiff.left);
  var rightInputView = new JsonInputView(document.getElementById('json-diff-right'), currentDiff && currentDiff.right);
  
  // 将getInputViews函数移到全局作用域
  window.getInputViews = function() {
    return {
      left: leftInputView,
      right: rightInputView
    };
  };
  
  // API 相关变量
  var autoRefreshTimer = null;
  var lastJson1 = null;
  var lastJson2 = null;

  // API 获取函数
  async function fetchJsonFromApi(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('获取 JSON 失败:', error);
      return null;
    }
  }

  // 更新 JSON 内容
  function updateJsonContent(json1, json2) {
    if (json1) {
      leftInputView.setText(json1);
    }
    if (json2) {
      rightInputView.setText(json2);
    }
    compareJson();
  }

  // 获取 JSON1
  async function fetchJson1() {
    const url = document.getElementById('left-api-url').value;
    if (!url) return;
    
    const json = await fetchJsonFromApi(url);
    if (json) {
      lastJson1 = json;
      updateJsonContent(json, lastJson2);
    }
  }

  // 获取 JSON2
  async function fetchJson2() {
    const url = document.getElementById('right-api-url').value;
    if (!url) return;
    
    const json = await fetchJsonFromApi(url);
    if (json) {
      lastJson2 = json;
      updateJsonContent(lastJson1, json);
    }
  }

  // 自动刷新控制
  function toggleAutoRefresh() {
    const autoRefresh = document.getElementById('polling-toggle').checked;
    const interval = document.getElementById('polling-interval').value;
    
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    
    if (autoRefresh) {
      autoRefreshTimer = setInterval(async () => {
        await fetchJson1();
        await fetchJson2();
      }, interval * 1000);
    }
  }

  // 绑定事件
  document.getElementById('left-api-url').addEventListener('change', fetchJson1);
  document.getElementById('right-api-url').addEventListener('change', fetchJson2);
  document.getElementById('polling-toggle').addEventListener('change', toggleAutoRefresh);
  document.getElementById('polling-interval').addEventListener('change', toggleAutoRefresh);

  leftInputView.on('change', onInputChange);
  rightInputView.on('change', onInputChange);
  leftInputView.codemirror.on('scroll', function () {
    var scrollInfo = leftInputView.codemirror.getScrollInfo();
    rightInputView.codemirror.scrollTo(scrollInfo.left, scrollInfo.top);
  });
  rightInputView.codemirror.on('scroll', function () {
    var scrollInfo = rightInputView.codemirror.getScrollInfo();
    leftInputView.codemirror.scrollTo(scrollInfo.left, scrollInfo.top);
  });

  if (currentDiff) {
    compareJson();
  }

  function onInputChange() {
    compareJson();
    saveDiff();
    debouncedSaveHistory();
  }

  function compareJson() {
    leftInputView.clearMarkers();
    rightInputView.clearMarkers();
    var leftText = leftInputView.getText(), rightText = rightInputView.getText();
    var leftJson, rightJson;
    try {
      if (leftText) {
        leftJson = JSON.parse(leftText);
      }
      if (rightText) {
        rightJson = JSON.parse(rightText);
      }
      document.getElementById('error-message').style.display = 'none';
    } catch (e) {
      document.getElementById('error-message').style.display = 'inline-block';
    }
    if (!leftJson || !rightJson) return;
    var diffs = jsonpatch.compare(leftJson, rightJson);
    window.diff = diffs;

    diffs.forEach(function (diff) {
      try {
        if (diff.op === 'remove') {
          leftInputView.highlightRemoval(diff);
        } else if (diff.op === 'add') {
          rightInputView.highlightAddition(diff);
        } else if (diff.op === 'replace') {
          rightInputView.highlightChange(diff);
          leftInputView.highlightChange(diff);
        }
      } catch(e) {
        console.warn('error while trying to highlight diff', e);
      }
    });
  }

  function saveDiff() {
    if (!localStorage.getItem('dont-save-diffs')) {
      var currentDiff = getCurrentDiff();
      localStorage.setItem('current-diff', currentDiff);
    }
  }
  var debouncedSaveHistory = _.debounce(saveHistory, 5000);
  function saveHistory() {
    if (dontTriggerSaveDiff) {
      dontTriggerSaveDiff = false;
      return;
    }
    var currentDiff = getCurrentDiff();
    if (window.diff) {
      diffHistory.push({
        time: Date.now(),
        diff: currentDiff
      });
      renderDiffHistory();
      forceMaxArraySize(diffHistory, 20);
      if (!localStorage.getItem('dont-save-diffs')) {
        localStorage.setItem('diff-history', JSON.stringify(diffHistory));
      }
    }
  }

  function forceMaxArraySize(arr, size) {
    var over = arr.length - size;
    arr.splice(0, over);
  }

  function getCurrentDiff() {
    var leftText = leftInputView.getText(), rightText = rightInputView.getText();
    return JSON.stringify({
      left: leftText, right: rightText
    });
  }

  function renderDiffHistory() {
    var inner = _.reduceRight(diffHistory, function (acc, item, i) {
      var diff = JSON.parse(item.diff);
      acc += historyItemTemplate({
        time: new Date(item.time),
        historyString: (diff.left + ' ' + diff.right).substr(0, 40),
        index: i
      });
      return acc;
    }, '');
    var html = '<ul class="diff-history-list">' + inner + '</ul>';
    $('#history-container').html(html);
  }

  window.compareJson = compareJson;
  window.onClickHistoryItem = function (i) {
    var item = diffHistory[i];
    var diff = JSON.parse(item.diff);
    if (diff.left !== leftInputView.getText() && diff.right !== rightInputView.getText()) {
      dontTriggerSaveDiff = true;
    }
    leftInputView.setText(diff.left);
    rightInputView.setText(diff.right);
  }
})();
