import React, { Component } from 'react';
import {
    Switch,
    Route,
  } from "react-router-dom";
import HomePage from "./views/pages/homepage/homepage"
import About from "./views/pages/about/about"
import LoginPage from "./views/pages/login/login-page"

export default class Routes extends Component {
  

  render() {
    return (
        <Switch>
            {/* NOTE: / must be the last path in the switch */}
            <Route path="/test">
              <h2>This worked</h2>
            </Route>

            <Route exact path="/about" >
               <About/> 
            </Route>
            
            <Route exact path="/login" >
              <LoginPage/>
            </Route>

            <Route exact path="/" >
              <HomePage name = "Emilia" />
            </Route>
        </Switch>
        
    );
  }
}