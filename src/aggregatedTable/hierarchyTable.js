class HierarchyTable{
  /**
   * Converts flat view rowheaders into a tree-view rowheaders with ability to switch between views.
   * After hierarchy is initialized, `HierarchyTable.data` array will reflect the rows of the table in their visible order and contain `meta` for each row in the array.
   * When a row is collapsed, a `reportal-table-hierarchy-collapsed` Event is fired.
   * When a row is uncollapsed, a `reportal-table-hierarchy-uncollapsed` Event is fired.
   * When a row is switched to flat-view, a `reportal-table-hierarchy-flat-view` Event is fired.
   * When a row is switched to tree-view, a `reportal-table-hierarchy-tree-view` Event is fired.
   * @param {HTMLTableElement} source - source table that needs a cloned header
   * @param {Array} hierarchy - array of hierarchy objects from reportal
   * @param {Object} rowheaders - JSON object which contains all table rowheaders with category id and index of table row
   * @param {Number} [hierColumn=0] - index of column in the table that contains hierarchy (increments from `0`)
   * @param {Boolean} [flat=false] - Should hierarchy be rendered flatly(`true`), or in a tree-fashion (`false`).
   * */
  constructor({source,hierarchy,rowheaders,hierColumn = 0,flat = false,search={}} = {}){
    this.source = source;
    this.hierarchy = hierarchy;
    this.rowheaders = rowheaders;
    this.data=null;
    this.column = hierColumn;
    this._collapseEvent = this.constructor.newEvent('reportal-table-hierarchy-collapsed');
    this._uncollapseEvent = this.constructor.newEvent('reportal-table-hierarchy-uncollapsed');
    this._flatEvent = this.constructor.newEvent('reportal-table-hierarchy-flat-view');
    this._treeEvent = this.constructor.newEvent('reportal-table-hierarchy-tree-view');
    this.flat = flat;
    this.search = this.setupSearch(search);

    this.init();
  }

  /**
   * This function initializes a prototype for search functionality for hierarchical column
   * @param {Boolean} enabled=false - flag to be set when enabling the search
   * @param {Boolean} immediate=false - flag to be set for serach to happen after each stroke rather than by `timeout`
   * @param {Number} timeout=300 - minimal time after last keystroke when searching takes place
   * @param {Boolean} [searching=false] - this property is mostly for internal use and is set when searching is in progress, which adds a class to the table hiding all rows not matching search
   * @param {String} [query=''] - search string
   * @param {HTMLInputElement} target - the input element that triggered the search.
   * */
  setupSearch({enabled = false, immediate = false, timeout=300, searching=false, query='', target}={}){
    var _searching = searching,
      source = this.source,
      _query = query;
    return {
      timeout,
      enabled,
      immediate,
      target,
      get query(){return _query},
      set query(val){
        _query = val;
      },

      get searching(){return _searching},
      set searching(val){
        if(this.searching!=val){
          _searching=val;
          source.classList.toggle('reportal-hierarchy-searching');
        }
      }
    }
  }

  /**
   * Initializes the hierarchical structure for a table by creating new set of table rows with correct order and additional information in attributes
   * */
  init(){
    this.data = this.data || this.parseHierarchy();
    let tbody = this.source.querySelector("tbody");
    if(tbody.firstChild && tbody.firstChild.nodeType==3){
      tbody.removeChild(tbody.firstChild)
    }
    this.data.forEach((item)=>{tbody.appendChild(item.meta.row);});
  }


  /**
   * Sets `this.flat`, adds/removes `.reportal-heirarchy-flat-view` to the table and updates labels for hierarchy column to flat/hierarchical view
   * */
  set flat(flat){
    this._flat=flat;
    flat?this.source.classList.add('reportal-heirarchy-flat-view'):this.source.classList.remove('reportal-heirarchy-flat-view');
    if(this.data){
      this.data.forEach((row)=> {
        this.updateCategoryLabel(row);
      });
    }
    flat?this.source.dispatchEvent(this._flatEvent):this.source.dispatchEvent(this._treeEvent)
  }
  /**
   * getter for `flat`
   * @return {Boolean}
   * */
  get flat(){
    return this._flat;
  }

  /**
   * Replaces category label in the array in the hierarchical column position and in the html row through meta. Replacing it in the array is important for sorting by category.
   * @param {Array} row - an item in the `this.data` Array
   * */
  updateCategoryLabel(row){
      let cell = row.meta.row.children.item(this.column),
      // we want to male sure if there is a link (drill-down content) then we populate the link with new title, else write to the last text node.
        label = cell.querySelector('a')? cell.querySelector('a').textContent : cell.childNodes.item(cell.childNodes.length-1).nodeValue;
      row[this.column] = label = this.flat? row.meta.flatName: row.meta.name;
  }

  /**
   * Recursive function taking rows according to `hierarchy` object, adding information to that row, retrieving data from the row, and adding this array to `this.data`
   * Each item in the array has a `meta {Object}` property that has the following structure:
   *
   * ``` javascript
   * {
   *    collapsed: Boolean, // if true, the row is collapsed, defined if `hasChildren`
   *    hasChildren: Boolean, // if true, it has children
   *    flatName: String, // label for flat view ('/'-separated)
   *    name: String, // label for the current level (single-label without parent prefixes)
   *    id: String, // item id from Reportal table
   *    level: Number, // hierarchy level
   *    parent: String, // parent id of the nested level
   *    row: HTMLTableRowElement // reference to the `tr` element in the table
   * }
   * ```
   *
   * @param {Array} hierarchy - array of hierarchy objects from reportal
   * @param {int} level - depth of the function
   * @param {Array} array - changedTable for children level
   * @return {Array}
   */
  parseHierarchy(hierarchy=this.hierarchy,level=0,array=[]){
    return hierarchy.reduce((resultArray,item,index,array)=>{
      var row = this.source.querySelectorAll("tbody>tr")[this.rowheaders[item.id].index];
      row.setAttribute("self-id",item.id);

      row.classList.add("level"+level.toString());
      level > 0 ? row.classList.add("reportal-hidden-row") : null;
      level > 0 ? this.clearLink(row) : null;
      row.classList.add(item.children.length>0?"reportal-collapsed-row":"reportal-no-children");

      if(item.parent){
        row.setAttribute("parent",item.parent);
      }
      //we need to push to the array before we add arrows/circles to labels so that we have clean labels in array and may sort them as strings
      resultArray.push([].slice.call(row.children).map((td)=>{
          return td.children.length==0?this.constructor._isNumber(td.textContent.trim()):td.innerHTML
        }));
      let currentRowArray = resultArray[resultArray.length-1],
        self = this;//define it for complex closures
      //build a prototype for a row
    currentRowArray.meta= this.setupMeta({
      row:row,
      id:item.id,
      flatName: item.name,
      name: item.name.split('/').reverse()[0].trim(),
      parent:item.parent,
      level:level,
      hidden:true,
      collapsed:item.children.length>0?true:undefined,
      hasChildren:item.children.length>0
    });

      // adds a toggle button
      this.addCollapseButton(currentRowArray.meta);
      // initializes row headers according to `this.flat`
      this.updateCategoryLabel(currentRowArray);

      level < 2 ? resultArray = this.parseHierarchy(item.children, level + 1,resultArray) : null;
      return resultArray
    },array);
  }

  /**
   * This function builds a prototype for each row
   * @param {HTMLTableRowElement} row - reference to the `<tr>` element
   * @param {String} id - internal Reportal id for the row
   * @param {String} flatName - default string name ('/'-delimited) for hierarchy
   * @param {String} name - a trimmed version of `flatName` containing label for this item without parent suffices
   * @param {String} parent - internal Reportal id of parent row
   * @param {Number} level - level of hierarchy, increments form `0`
   * @param {Boolean} hidden=true - flag set to hidden rows (meaning their parent is in collapsed state)
   * @param {Boolean} collapsed=undefined - flag only set to rows which have children (`hasChildren=true`)
   * @param {Boolean} [matches=false] - flag set to those rows which match `search.query`
   * @param {Boolean} hasChildren=false - flag set to rows which contain children
   * */
  setupMeta({row,id,flatName,name,parent,level,hidden=true,collapsed,matches=false,hasChildren=false}={}){
    let _hidden = hidden, _collapsed = collapsed, self=this;
    return {
      row,
      id,
      flatName,
      name,
      parent,
      level,
      hasChildren,
      get hidden(){return _hidden},
      set hidden(val){
        _hidden=true;
        val?this.row.classList.add("reportal-hidden-row"):this.row.classList.remove("reportal-hidden-row");
      },
      get collapsed(){return _collapsed},
      set collapsed(val){
        if(typeof val != undefined){
          _collapsed=val;
          if(val){
            this.row.classList.add("reportal-collapsed-row");
            this.row.classList.remove("reportal-uncollapsed-row");
            this.row.dispatchEvent(self._collapseEvent);
          } else {
            this.row.classList.add("reportal-uncollapsed-row");
            this.row.classList.remove("reportal-collapsed-row");
            this.row.dispatchEvent(self._uncollapseEvent);
          }
        }
      }
    };

  }

  /**
   * Inspects if the current string might be converted to number and renders it as number. If string length is 0, returns `null`. If none applies returns the string as is.
   * @param {String} str - value of the cell if not HTML contents
   * @return {Number|null|String}
   * */
  static _isNumber(str){
    if(!isNaN(parseFloat(str)) && parseFloat(str).toString().length ==str.length){
      return parseFloat(str)
    } else if(str.length==0){return null} else {return str}
  }

  /**
   * Removes a drilldown link from elements that are the lowest level of hierarchy and don't need it
   * @param {HTMLTableRowElement} row - row element in the table
   * */
  clearLink(row){
    var link = row.querySelector("a");
    if(link) {
      link.parentElement.textContent = link.textContent;
    }
  }

  /**
   * function to add button to the left of the rowheader
   * @param {Object} meta - meta for the row element in the table
   */
  addCollapseButton(meta){
    var collapseButton = document.createElement("div");
    collapseButton.classList.add("reportal-collapse-button");
    collapseButton.addEventListener('click', () => {
      meta.collapsed = !meta.collapsed; //toggle collapsed state
      this.toggleHiddenRows(meta);
    });
    meta.row.children[this.column].insertBefore(collapseButton,meta.row.children[this.column].firstChild);
    meta.row.children[this.column].classList.add('reportal-hierarchical-cell');
  }

  static newEvent(name){
    //TODO: refactor this code when event library is added
    var event = document.createEvent('Event');
    // Define that the event name is `name`.
    event.initEvent(name, true, true);
    return event;
  }

  /**
   * function to hide or show child rows
   * @param {Object} meta - meta for the row element in the table
   */
  toggleHiddenRows(meta){
    if(meta.hasChildren){
      let children = this.data.filter((row)=>{return row.meta.parent==meta.id});
      children.forEach((childRow)=>{
        console.log(meta.collapsed);
        if(meta.collapsed){                                           // if parent (`meta.row`) is collapsed
          childRow.meta.hidden=true;                                  // hide all its children and
          if(childRow.meta.hasChildren && !childRow.meta.collapsed){  // if a child can be collapsed
            childRow.meta.collapsed=true;                             // collapse it and
            this.toggleHiddenRows(row.meta);                          // repeat for its children
          }
        } else {                                                      // otherwise make sure we show all children of an expanded row
          childRow.meta.hidden=false;
        }
      });
    }
  }

  searchRowheaders(str){
    let regexp = new RegExp(str,'gi'),
      matched = this.data.filter((row)=>{return this.flat?row.meta.flatName.match(regexp):row.meta.name.match(regexp)});
      //console.log(matched);
      matched.forEach((row) => {
        row.meta.row.classList.add('matched-search');
        this.uncollapseParents(row.meta);
        this.displayChildren(row.meta);
      });
    //return matched;
  }

  uncollapseParents(meta){
  if(meta.parent.length>0){ // if `parent` String is not empty - then it's not top level parent.
    let parent = this.data.find(row => row.meta.id==meta.parent);
    console.log(parent);
    if(parent.meta.collapsed){parent.meta.collapsed=false};
    parent.meta.row.classList.add('matched-search');
    this.uncollapseParents(parent.meta);
  }
  }

  displayChildren(meta){
      if (meta.hasChildren) {
        let children = this.data.filter(row => row.meta.parent == meta.id ).forEach(child => {child.meta.row.classList.add('matched-search');this.displayChildren(child.meta)});
      }
  }

}

/*Array.prototype.slice.call(document.querySelectorAll('table.reportal-hierarchy-table:not(.fixed)')).forEach((table)=>{
  var hierarchyTable= new HierarchyTable({source:table,hierarchy:hierarchy,rowheaders:rowheaders,flat:true});
});*/

export default HierarchyTable;
